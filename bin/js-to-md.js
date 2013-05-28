var fs = require("fs")
var esprima = require("esprima")
var argv = require("optimist").argv

var file = argv._[0]

fs.readFile(file, function (err, body) {
    if (err) {
        throw err
    }

    var sourceCode = String(body)

    var output = esprima.parse(sourceCode, {
        comment: true,
        loc: true,
        tokens: true,
        raw: true,
        range: true
    })

    var allTokens = output.comments.concat(output.tokens)
        .sort(function (a, b) {
            var aLine = a.loc.start.line
            var bLine = b.loc.start.line
            var aColumn = a.loc.start.column
            var bColumn = b.loc.start.column

            return aLine < bLine ? -1 :
                aLine > bLine ? 1 :
                aColumn < bColumn ? -1 : 1
        })

    var str = ""
    var inComment = true
    var previousEnd

    allTokens.forEach(function (token) {
        // we are entering a comment
        if (isComment(token) && inComment === false) {
            inComment = true

            str += "\n```"
        // we are leaving a comment
        } else if (!isComment(token) && inComment === true) {
            inComment = false

            str += "```js"
        }

        // console.log('range', token.range, token)
        // var start = token.range[0]
        var end = token.range[1]

        if (!isComment(token)) {
            str += sourceCode.substring(previousEnd, end)
        } else {
            str += token.value
        }

        previousEnd = end
    })

    if (inComment === false) {
        str += "\n```"
    }

    process.stdout.write(str + "\n")
})

function isComment(token) {
    return token.type === "Block"
}
