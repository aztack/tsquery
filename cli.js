const os = require('os');
const fs = require('fs');
const path = require('path');
const { Console } = require('console');
const { Transform } = require('stream');
const typescript = require('typescript');

const tsquery = require('./dist/src/index').tsquery;
const glob = require('glob');
const defaultInlineProcessor = 'return $';
const tsqueryrc = `${os.homedir()}/.tsqueryrc`;

const shorthands = {
  'class': 'ClassDeclaration > Identifier',
  'interface': 'ClassDeclaration > Identifier',
  'function': 'FunctionDeclaration > Identifier'
};
if (fs.existsSync(tsqueryrc)) {
  const content = fs.readFileSync(tsqueryrc).toString('utf-8');
  let config = {};
  try {
    config = JSON.parse(content);
  } catch (e) {
    console.error(`.tsqueryrc is not a valid JSON file!`);
  }
  for (let short in config) {
    const val = config[short];
    if (!val) continue;
    shorthands[short] = val;
  }
}

const pattern = process.argv[2];
let query = process.argv[3];
const callback = createNodeProcessor(query, process.argv[4]);
if (callback === -1) {
  console.error(`Invalid shorthand ${query}`);
  process.exit(-1);
}
if (process.argv.length <= 3) {
  printUsage();
  process.exit(0);
}
if (callback.query) query = callback.query;
const ts = new Transform({ transform(chunk, enc, cb) { cb(null, chunk) } });
const logger = new Console({ stdout: ts });

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
    {matched, index:idx}, {ast, tsquery, code: content, ts: typescript})
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
process.stdout.write(`],\n`);
process.stdout.write(`  count: ${count},\n`);
process.stdout.write(`  script: "${callback.type}",\n`);
process.stdout.write(`}`);

function createNodeProcessor(query, callback) {
  const ret = {type: '', fn: null, query: null};
  if (callback && callback.endsWith('.js') && fs.existsSync(callback)) {
    const p = path.resolve(process.cwd(), callback);
    callback = require(p);
  }
  if (!callback) callback = defaultInlineProcessor;

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
      if (query && query[0] === ':') {
        const cfg = shorthands[query.substring(1)];
        if (cfg) {
          if (Array.isArray(cfg) && callback.length >= 2 && typeof cfg[0] === 'string' && typeof cfg[1] === 'string') {
            ret.query = cfg[0];
            callback = cfg[1];
          } else {
            ret.query = cfg; // callback is query string
          }
        } else {
          return -1;
        }
      }
      ret.fn = new Function(...params, callback || defaultInlineProcessor); 
      ret.type = 'inline';
    }
  } else {
    ret.fn = new Function(...params, defaultInlineProcessor); 
    ret.type = 'default';
  }
  return ret;
}

function printUsage() {
  console.log(`${path.basename(process.argv[1], '.js')} <glob-pattern> <ts-query-string> [inline-script | js-file-path]`);
}