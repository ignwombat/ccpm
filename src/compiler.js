// TODO peerdeps
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const { execSync } = require('child_process');

for (let i = 0; i < process.stdout.getWindowSize()[1]; i++) {
    console.log('\r\n')
}

const chalk = require("chalk");

const readFile = (filePath) => fs.readFileSync(filePath, 'utf-8')
    .toString();

function writeFile(filePath, data) {
    fs.writeFileSync(filePath, data, 'utf-8');
}

const [,,entry, ...args] = process.argv;

const isDependency = args.includes('dependency');
const force = args.includes('force');

const compiledDependencies = args.find(arg => arg.startsWith('compiledDependencies='))
    ?.replace('compiledDependencies=', '')
    .split(',').map(dep => {
        const [name, path] = dep.split(':')
        return { name, path }
    }) ?? [];

if (!entry) throw new Error(
    'No entry path was passed to npm run compile. Usage: npm run compile <entry-path> E.G: npm run compile path/to/entry'
);

const entryPath = path.resolve(entry);
console.log(chalk.magenta(`compiling ${entryPath}\n`));

const packageJsonPath = path.join(entryPath, 'package.json');
if (!fs.existsSync(packageJsonPath)) throw new Error(`no package.json was found in ${entryPath}`);

let packageJson, main, mainPath, files, dependencies;

try {
    packageJson = JSON.parse(readFile(packageJsonPath));
    main = packageJson.main;

    if (main !== undefined) {
        if (typeof main !== 'string') throw new Error(`main entry file must be of type string, got ${typeof main}`);
        if (!main.endsWith('.lua')) throw new Error(`main entry file must be a .lua file`);

        mainPath = path.join(entryPath, main);
        if (!fs.existsSync(mainPath)) throw new Error(`main entry file ${main} was not found`);
    }

    else if (!isDependency) throw new Error('no main entry file was specified');

    files = packageJson.files ?? [];
    if (!(files instanceof Array)) throw new Error('files must be of type Array');

    if (packageJson.dependencies && isDependency) throw new Error('use peerDependencies to prevent recursion');

    dependencies = packageJson.dependencies ?? {};
    if (typeof dependencies !== 'object' || dependencies instanceof Array) throw new Error('dependencies must be of type Object');
} catch(err) {
    throw new Error(`Failed to parse package.json: ${err.message}`);
}

const filesToInclude = [];
files.forEach(pattern => {
    const paths = glob.sync(pattern, { cwd: entryPath, ignore: main? [main, '.out/**']:'.out/**' });
    filesToInclude.push(...paths.map(filePath => ({
        path: filePath,
        cwd: entryPath,
        luaPath: filePath
            .replace(/[\/\\]/g, '.')
            .replace(/\.lua$/, '')
    })));
});

function installDependency(name, depPath) {
    const depPackagePath = path.join(depPath, 'package.json');
    if (!fs.existsSync(depPackagePath)) throw new Error(`dependency package ${depPackagePath} was not found`);

    try {
        const depPackageJson = JSON.parse(readFile(depPackagePath));
        const depMain = depPackageJson.main;

        const peerDependencies = depPackageJson.peerDependencies;
        if (peerDependencies !== undefined) {
            if (typeof peerDependencies !== 'object' || peerDependencies instanceof Array) throw new Error('dependencies must be of type Object');

            for (const key in peerDependencies) {
                const peerDepPath = peerDependencies[key];
                if (compiledDependencies.find(dep => dep.name === key)) continue;

                console.log(' └──── ' + chalk.gray(key));
                installDependency(key, peerDepPath);
                compiledDependencies.push({ name: key, path: peerDepPath });
            }
        }

        if (depMain !== undefined) {
            if (typeof depMain !== 'string') throw new Error(`main entry file must be of type string, got ${typeof main}`);
            if (!depMain.endsWith('.lua')) throw new Error(`main entry file must be a .lua file`);
            
            const depMainFileName = depMain.replace(/^.*[\/\\]/, '');
            const compiledPath = path.join(depPath, '.out', depMainFileName);
            const isCompiled = !force && fs.existsSync(compiledPath);

            if (!isCompiled) {
                try {
                    execSync(
                        `node src/compiler.js ${depPath} dependency compiledDependencies=${compiledDependencies.map(
                            dep => dep.name + ':' + dep.path
                        ).join(',')}`);
                } catch(err) {
                    throw new Error(`failed to compile: ${err.message}`);
                }
            }

            filesToInclude.push({
                path: compiledPath,
                cwd: process.cwd(),
                luaPath: 'ccpm_modules.' + compiledPath
                    .replace(/[\/\\]\.out[\/\\]?/, '')
                    .replace(/[\/\\]/g, '.')
                    .replace(depMainFileName, '')
                    .replace(/\.lua$/, '')
            });
        }

        else {
            const depFiles = depPackageJson.files ?? [];
            if (!(depFiles instanceof Array)) throw new Error('files must be of type Array');

            depFiles.forEach(pattern => {
                const paths = glob.sync(pattern, { cwd: depPath, ignore: '.out/**' });
                filesToInclude.push(...paths.map(filePath => ({
                    path: filePath,
                    cwd: depPath,
                    luaPath: ('ccpm_modules.' + depPath + '.' + filePath)
                        .replace(/[\/\\]/g, '.')
                        .replace(/\.lua$/, '')
                })));
            });
        }
    } catch(err) {
        throw new Error(`failed to parse dependency ${depPath}: ${err.message}`);
    }
}

console.log(chalk.bgGreen('installing dependencies'));

for (const key in dependencies) {
    const depPath = dependencies[key];
    if (compiledDependencies.find(dep => dep.name === key)) continue;
    
    console.log('[+] ' + key);
    installDependency(key, depPath);

    compiledDependencies.push({ name: key, path: depPath });
}

const parsedFiles = filesToInclude.map(file => {
    if (!file.path.endsWith('.lua')) console.log(`WARNING: file ${file.path} does not contain a .lua extension. The code may not run properly`);
    let fileContents = readFile(path.join(file.cwd, file.path));

    return `----${file.path}----
${isDependency? 'dep_modules':'modules'}['${file.luaPath}'] = function()
${fileContents}
end`
}).join('\n');

const mainContents = readFile(mainPath);
const template = readFile(path.join(__dirname, isDependency?'dependencyTemplate.lua':'template.lua'));

let compiled = template
    .replace(/\-{2}\{FILES\}\-{2}/, parsedFiles)
    .replace(/\-{2}\{MAIN\}\-{2}/, mainContents);

const outDir = path.join(entryPath, '.out');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const outFile = path.join(outDir, main.replace(/.*[\/\\]/, ''))
writeFile(
    outFile,
    compiled
);

console.log(chalk.green(`\noutput generated at ${outFile}\n`));