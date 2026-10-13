const fs=require('fs');const ob=require('javascript-obfuscator');
const code=fs.readFileSync('main.js','utf8');
const opts={compact:true,simplify:true,renameProperties:false,transformObjectKeys:false,renameGlobals:false,selfDefending:false,debugProtection:false,disableConsoleOutput:false,splitStrings:false,numbersToExpressions:false,unicodeEscapeSequence:false,identifierNamesGenerator:'mangled',controlFlowFlattening:true,controlFlowFlatteningThreshold:0.5,deadCodeInjection:false,stringArray:true,stringArrayThreshold:1,stringArrayEncoding:['base64'],stringArrayRotate:true,stringArrayShuffle:true,stringArrayWrappersCount:2};
const out=ob.obfuscate(code,opts).getObfuscatedCode();
fs.writeFileSync('_diag_main.js',out);
console.log('wrote bytes=',out.length);
