const fs = require('fs');
const path = require('path');
const { Console } = require('console');
const { Transform } = require('stream');

const tsquery = require('./dist/src/index').tsquery;
const glob = require('glob');

const pattern = process.argv[2];
const query = process.argv[3];
const callback = createNodeProcessor(process.argv[4]);
const ts = new Transform({ transform(chunk, enc, cb) { cb(null, chunk) } });
const logger = new Console({ stdout: ts });

if (process.argv.length <= 3) {
  printUsage();
  process.exit(0);
}

let count = 0;
let first = true;
const matched = glob.sync(pattern);
if (process.argv.indexOf('--list-file') > 0) {
  console.log(matched);
  process.exit(0);
}

process.stdout.write("{\n")
process.stdout.write(`  query: "${query}",\n`)
process.stdout.write(`  result: [`)
matched.forEach((file, idx) => {
  if (fs.statSync(file).isDirectory()) return;
  const content = fs.readFileSync(file).toString();
  const basename = path.basename(file, path.extname(file));
  const ast = tsquery.ast(content);
  const nodes = tsquery(ast, query);
  const json = {file, basename, count: nodes.length, result: null};
  json.result = nodes.map((node) => callback.fn(
    node, file, basename, 
    {matched, index:idx}, {ast, tsquery, code: content})
  ).filter(x => x !== false);
  if (!json.result.length) return;
  if (!first) process.stdout.write(",");
  if (first) first = false;


  // indent
  logger.log(json);
  const output = (ts.read() || '').toString().trim().replace(/\t/g, '  ');
  process.stdout.write(output.replace(/\n/g, `\n  `));
  count++;
});
process.stdout.write(`],\n`)
process.stdout.write(`  count: ${count},\n`)
process.stdout.write(`  script: "${callback.type}",\n`)
process.stdout.write(`}`)

function createNodeProcessor(callback) {
  const ret = {type: '', fn: null};
  if (callback && callback.endsWith('.js') && fs.existsSync(callback)) {
    const p = path.resolve(process.cwd(), callback);
    callback = require(p);
  }

  const params = ['$','$filepath', '$filename', '$files', '$tsq'];
  if (callback) {
    if (typeof callback === 'function') {
       ret.fn = function () {
        try {
          
          return callback(...arguments);
        } catch (e) {}
      }
      ret.type = 'script';
    } else {
      ret.fn = new Function(...params, callback); 
      ret.type = 'inline';
    }
  } else {
    ret.fn = new Function(...params, `return $`); 
    ret.type = 'default';
  }
  return ret;
}

function printUsage() {
  console.log(`${path.basename(process.argv[1], '.js')} <glob-pattern> <ts-query-string> [inline-script | js-file-path]`);
}