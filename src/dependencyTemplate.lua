local dep_loadedModules = {}
local dep_modules = {}

local function require(path)
    local resolved = modules[path] or dep_modules[path]
    if type(resolved) ~= "function" then
        path = "ccpm_modules."..path

        resolved = modules[path] or dep_modules[path]
        if type(resolved) ~= "function" then
            error("Module "..path.." not found")
        end
    end
    
    local resolvedLoaded = loadedModules[path] or dep_loadedModules[path]
    if resolvedLoaded ~= nil then
        return resolvedLoaded
    end

    local module = resolved()
    dep_loadedModules[path] = module

    return module
end

--{FILES}--
--{MAIN}--