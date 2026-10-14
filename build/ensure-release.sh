#!/usr/bin/env bash
# 确保 GitHub Release 存在（幂等）。不存在则用 REST API 创建（只需 repo scope）。
# 用法：source build/ensure-release.sh && ensure_release "<tag>"
# 目的：消除「release not found」——即使 create-release 因并发取消而没跑，
#       第一个真正要上传的 step 也会自动把 Release 建出来。
ensure_release() {
  local TAG="$1"
  if [ -z "$RELEASE_REPO" ] || [[ "$RELEASE_REPO" == *undefined* ]]; then
    echo "::error::RELEASE_REPO 未设置或解析失败（=$RELEASE_REPO），无法确保 Release 存在"
    return 1
  fi
  if [ -z "$GH_TOKEN" ]; then
    echo "::error::GH_TOKEN 未设置，无法确保 Release 存在"
    return 1
  fi
  local API="https://api.github.com/repos/$RELEASE_REPO/releases"
  local CODE
  CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "$API/tags/$TAG")
  if [ "$CODE" = "200" ]; then
    echo "Release $TAG 已存在，跳过创建。"
    return 0
  fi
  echo "Release $TAG 不存在（HTTP $CODE），用 REST API 创建…"
  local HTTP
  HTTP=$(curl -s -o /tmp/ensure-release-resp.json -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "Content-Type: application/json" \
    --data "{\"tag_name\":\"$TAG\",\"name\":\"$TAG\",\"draft\":false,\"prerelease\":false,\"make_latest\":\"true\"}" \
    "$API")
  if [ "$HTTP" != "201" ]; then
    echo "::error::ensure_release 创建失败，HTTP $HTTP"; cat /tmp/ensure-release-resp.json; return 1
  fi
  echo "Release $TAG 已创建。"
  return 0
}
