const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=path.join(root,'public'),target=path.join(root,'dist');
fs.mkdirSync(target,{recursive:true});fs.cpSync(source,target,{recursive:true});console.log('Static site built in '+target);
