local printMessage = require("lib.printlib.printMessage")

return function(a, b)
    printMessage("sum was called with parameters: "..a..", "..b)
    return a + b
end