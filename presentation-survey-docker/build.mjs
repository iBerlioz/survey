import {build} from 'esbuild';
await build({entryPoints:['src/main.tsx'],bundle:true,outfile:'public/app.js',minify:true,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
