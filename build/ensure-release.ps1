# 确保 GitHub Release 存在（幂等）。不存在则用 REST API 创建（只需 repo scope）。
# 用法：. build/ensure-release.ps1 ; Ensure-Release "<tag>"
# 目的：消除「release not found」——即使 create-release 因并发取消而没跑，
#       第一个真正要上传的 step 也会自动把 Release 建出来。
function Ensure-Release {
  param([string]$Tag)
  if (-not $env:RELEASE_REPO -or $env:RELEASE_REPO -like "*undefined*") {
    Write-Error "RELEASE_REPO 未设置或解析失败（=$env:RELEASE_REPO），无法确保 Release 存在"
    exit 1
  }
  if (-not $env:GH_TOKEN) {
    Write-Error "GH_TOKEN 未设置，无法确保 Release 存在"
    exit 1
  }
  $api = "https://api.github.com/repos/$env:RELEASE_REPO/releases"
  $hdr = @{ Authorization = "Bearer $env:GH_TOKEN"; Accept = "application/vnd.github+json" }
  $code = 404
  try {
    $r = Invoke-WebRequest -Uri "$api/tags/$Tag" -Headers $hdr -Method Get -UseBasicParsing -ErrorAction SilentlyContinue
    $code = [int]$r.StatusCode
  } catch {
    $code = 404
  }
  if ($code -eq 200) {
    Write-Host "Release $Tag 已存在，跳过创建。"
    return
  }
  Write-Host "Release $Tag 不存在（HTTP $code），用 REST API 创建…"
  $body = @{ tag_name = $Tag; name = $Tag; draft = $false; prerelease = $false; make_latest = "true" } | ConvertTo-Json
  try {
    $resp = Invoke-WebRequest -Uri $api -Headers $hdr -Method Post -Body $body -ContentType "application/json" -UseBasicParsing
    if ([int]$resp.StatusCode -ne 201) {
      Write-Error "Ensure-Release 创建失败，HTTP $($resp.StatusCode)"
      exit 1
    }
  } catch {
    Write-Error "Ensure-Release 创建异常: $_"
    exit 1
  }
  Write-Host "Release $Tag 已创建。"
}
