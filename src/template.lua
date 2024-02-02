--Code generated using ccpm
--https://github.com/ignwombat/ccpm

local loadedModules = {}
local modules = {}

local _require = require
local function require(path)
    if type(modules[path]) ~= "function" then
        path = "ccpm_modules."..path

        if type(modules[path]) ~= "function" then
            error("Module "..path.." not found")
        end
    end
    
    if loadedModules[path] ~= nil then
        return loadedModules[path]
    end

    local module = modules[path]()
    loadedModules[path] = module

    return module
end

--{FILES}--
--{MAIN}--