# CCPM compiler
A simple node.js program to compile .lua files together. Its purpose is to be able to work in multiple different .lua files, and still be able to upload it as a single file to pastebin for usage in computercraft.

## Installation
The compiler uses a few additional NPM libraries to work. You need to run `npm install` before using it.

## Usage
CCPM is heavily inspired by NPM, hence the name, and the usage of package.json files. Please refer to the [example](./example/) project

To compile the code, run `npm run compile example`

The code will compile to the `.out` folder in the same directory.

In this case, `example` is the path to the project root.

**Note:** if a dependency includes its own `main` file, it will compile all the modules into one file. If said dependency already has an entry in the `.out` folder, this will be used. To ignore this, refer to the following example:
```
npm run compile example force
```
