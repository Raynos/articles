/*
# Programming with delayed computation

A delayed computation is a function that will do some computation
    when called. Because of the delayed nature the computation may
    be asynchronous so the function takes a callback.

This means that a delayed computation can be seen as a function
    that takes a callback and does some work.

*/
var somethingExpensive = function () {}

function doWork(callback) {
    var list = []
    for (var i = 0; i < 1000; i++) {
        list.push(somethingExpensive())
    }
    callback(null, list)
}
/*

For our use-cases we use the standard node style callback so that
    a delayed computation can either return a result or an error.

Now it should be noted that within the scope of single threaded
    javascript like in browsers or in node.js it would not make
    sense to do a bunch of expensive computation in a for loop

A better example of a delayed computation that is asynchronous
    would be file IO

*/
var fs = require("fs")
var path = require("path")
var process = require("process")

function readPackageJson(callback) {
    fs.readFile(path.join(process.cwd(), "package.json"), callback)
}

function readProject(callback) {
    fs.readFile(process.cwd(), callback)
}
/*

These look exactly like normal functions that use callbacks that
    we are familiar with. One of the things we can do with this
    is pass the `readPackageJson` or `readProject` function
    around and it has contained all the logic for what it
    means to do that operation.

There is another way that we can generate these delayed computations
    using `Function.prototype.bind`

*/
var readPackageJson = fs.readFile.bind(
    path.join(process.cwd(), "package.json"))

var readProject = fs.readFile.bind(process.cwd())
/*

Here we use bind to create a delayed computation for us. We just
    basically tell it to create a function which accepts a callback
    but has all the other arguments to `fs.readFile` set.

Now let's say we want to do something more generic then just
    read the package.json in our current working directory

*/
function readPackageJson(folder) {
    return function readPackageJsonInFolder(callback) {
        fs.readFile(path.join(folder, "package.json"), callback)
    }
}

function readPackageJson(folder) {
    return fs.readFile.bind(path.join(folder, "package.json"))
}
/*

Here we have used both the longer and the `.bind` form. We will be
    using the shorter, more convenient bind form of creating
    delayed computation for the rest of the article.

Let's take a look at some real examples, say we want to load
    a profile file from disk. Our profiles are stored in a
    folder that we have to access asynchronously

*/
function profilesFolder(callback) {
    // for now just return profiles. In future prompt user
    // over stdin or do an async stat to see whether it already
    // exists / etc
    callback(null, "~/.profiles")
}

var safeParse = require("json-safe-parse")

function getProfile(profileName) {
    return function getProfileByName(callback) {
        // read the profilesFolder
        profilesFolder(function (err, profilesFolder) {
            if (err) {
                return callback(err)
            }

            // generate fileUri
            var fileUri = path.join(profilesFolder, profileName + ".json")
            var file = fs.readFile.bind(null, fileUri)

            // we have to consume the file so we can json parse it
            file(function (err, file) {
                if (err) {
                    return callback(err)
                }

                var json = safeParse(String(file))

                // we now just pass the original callback to
                // getProfileByName to the json delayed computation
                // which will return either the JSON.parse error or
                // the payload to the caller
                json(callback)
            })
        })
    }
}
/*

So in our implementation of getProfile we have used multiple
    delayed computations. We create a delayed computation for
    getting the profile. We have read the the delayed computation
    for getting the profilesFolder location, we then read the file
    as a delayed computation and then do safe json parsing as a
    delayed computation.

If we wanted to think of this code at a higher level and step away
    from the callbacks and errors we would say

 - asynchronously read profilesFolder
 - synchronously transform profilesFolder into fileUri
 - asynchronously transform fileUri into file content
 - asynchronously transform file content into json object
 - return json object

Now the complex parts, code wise in the algorithm is the notion
    of asynchronously transforming things because both transforms
    include a `if (err) { callback(err) }` block and a level of
    indentation.

We can make this simpler by writing a function that does the
    generic parts of an asychronous transformation. For now
    let's call it `chain`

`chain` will take a delayed computation and a function which
    takes the result of the computation and returns a new delayed
    computation. This is effectively an asynchronous transformation.

For example to transform file content into json we grab the
    computation for the readFile and we take a function that
    takes the text content of the file and returns a delayed
    computation for json

*/
function chain(delayedComputation, transformation) {
    // return new computation
    return function newDelayedComputation(callback) {
        // run the delayed computation
        delayedComputation(function (err, value) {
            // if we have an error just pass it through
            if (err) {
                return callback(err)
            }

            // call the transformation
            // pass the callback to the computation that the
            // transformation returns
            transformation(value)(callback)
        })
    }
}

var safeParse = require("json-safe-parse")

function getProfile(profileName) {
    var file = chain(profilesFolder, function (profilesFolder) {
        var fileUri = path.join(profilesFolder, profileName + ".json")
        return fs.readFile.bind(null, fileUri)
    })

    var json = chain(file, function (content) {
        return safeParse(content)
    })

    return json
}
/*

Let's look at the description of the algorithm again

 - asynchronously read profilesFolder
 - synchronously transform profilesFolder into fileUri
 - asynchronously transform fileUri into file content
 - asynchronously transform file content into json object
 - return json object

We have modelled this as

 - asynchronous transform the profilesFolder into
        a fileUri to read and the file content at that uri
 - asynchronous transform the file content into a json object
 - return the json object

We can actually do better still !

*/
function getProfile(profileName) {
    var file = chain(profilesFolder, function (profilesFolder) {
        var fileUri = path.join(profilesFolder, profileName + ".json")
        return fs.readFile.bind(null, fileUri)
    })

    return chain(file, safeParse)
}
/*

Note that in this implementation we just say the important bits.
    We don't talk about callbacks or asynchronous code, that
    is just an implementation detail.

The benefit of our usage of chain is the ability to express our
    actual algorithm without the boilerplate, this improves our
    reasoning ability
*/
