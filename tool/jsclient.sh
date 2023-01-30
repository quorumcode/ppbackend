#!/bin/bash

  # Current directory
    pwd=$(realpath $(pwd))

  # Dir of script
    shdir=$(realpath "$(dirname "${BASH_SOURCE[0]}")")

. "$shdir"/_shlib -- "
    Make JS client for API
"

fnGenerator() {
    echo "$1/node_modules/.bin/openapi-generator-cli"
}

fnBrowserify() {
    echo "$1/node_modules/.bin/browserify"
}

fnUglify() {
    echo "$1/node_modules/.bin/uglifyjs"
}

# Install required tools, if absent
installTools() {
    ppdir="$1"
    echo $ppdir

  # Install JAVA, if absent
    if [ ! -e /usr/bin/java ] ; then
        sudo apt install default-jre
    fi

  # Install Maven, if absent
    if [ ! -e /usr/bin/mvn ] ; then
        sudo apt install maven
    fi

  # Install JS beautify, if absent
    if [ ! -e /usr/bin/js-beautify ] ; then
        sudo apt install jsbeautifier
    fi

  # See https://github.com/OpenAPITools/openapi-generator
  # See https://openapi-generator.tech/
  # Install nodejs module as dev-dependence, if absent
    generator="$(fnGenerator "$ppdir")"
    if [ ! -e "$generator" ] ; then
        npm i @openapitools/openapi-generator-cli -D
    fi

  # Install nodejs module as dev-dependence, if absent
    browserify=$(fnBrowserify "$ppdir")
    if [ ! -e "$browserify" ] ; then
        npm i browserify -D
    fi

  # Install nodejs module as dev-dependence, if absent
    uglify=$(fnUglify "$ppdir")
    if [ ! -e "$uglify" ] ; then
        npm i uglify-js -D
    fi
}

_cmdinfo_make="YamlPath TargetDir, YamlPath - path to DefinitionBody in YAML, TargetDir - Target directory for jsclient (CLEAR BEFORE MAKE)"
_cmdcode_make() {

  # Root directory of PollenPay project
    ppdir=$(realpath "$(dirname "${BASH_SOURCE[0]}")/..")

  # Path in YAML to DefinitionBody
    yamlpath="$1"
    if [ "" == "$yamlpath" ] ; then
        echo "YamlPath required"
        return
    fi

  # Target directory for JS client
    targetdir=$(realpath "$2")
    if [ "" == "$targetdir" ] ; then
        echo "TargetDir required"
        return
    fi

  # Rename target dir before make
    if [ -e "$targetdir" ] ; then
        mv "$targetdir" "$targetdir.bak"
    fi

  # Install tools, if absent
    installTools "$ppdir"

    export JS_POST_PROCESS_FILE="/usr/bin/js-beautify -r -f"

  # Extract API name from YAML path
    apiName=$(echo "$yamlpath" | grep -o -E '[a-zA-Z0-9]+API')
    if [ "" == "$apiName" ] ; then apiName="PPAPI" ; fi

  # Tool create openapitools.json in current directory
    cd "$shdir" || exit

  # Generate client code
  # Can be configurate https://openapi-generator.tech/docs/generators/javascript
    "$(fnGenerator "$ppdir")" generate -i <(yq "$yamlpath" "$ppdir/v2x.yaml") -g javascript \
        -o "$targetdir" -c "$shdir/jsclient.yaml" --enable-post-process-file --generate-alias-as-model \
        --type-mappings "integer+int64=BigInt"

    cd "$targetdir" || exit
    sed 's/var data = this.deserialize(response, returnType);/var data = this.deserialize(response, 400 === response.status ? Error : returnType);\n                        if ((200 === response.status) \&\& ((true === data?.error) || (true === data?.err))) data = this.deserialize(response, Error);/g' -i ./src/ApiClient.js
    sed 's/data\[auth.name\] = auth.apiKey;/if (Object(auth.apiKey) === auth.apiKey) data = auth.apiKey; else data[auth.name] = auth.apiKey;/g' -i ./src/ApiClient.js
    find "$targetdir/src" -name "*.js" -exec sed -i "s/import BigInt from '.\/BigInt';//g" '{}' \;
    npm i
    npm run build
    cd dist || exit
    "$(fnBrowserify "$ppdir")" ./index.js --standalone "$apiName" > "./${apiName,,}-bundle.js"
    "$(fnUglify "$ppdir")" "./${apiName,,}-bundle.js" > "./${apiName,,}-bundle.min.js"

  # Extract API definition as JSON from YAML to file
    yq "$yamlpath" "$ppdir/v2x.yaml" > "$(dirname "$targetdir")/test/yaml.json"
    node "$ppdir/tool/d/debjson.js" "$(dirname "$targetdir")/test/yaml.json" "$(dirname "$targetdir")/test/debug.json"

  # Rebuild devApp
    devdir="$targetdir/../../devApp"

    if [ ! -e "$devdir/node_modules/.bin/ng" ] ; then
        cd "$devdir" || exit
        echo "Install modules for devApp"
        npm i
    fi

    if netstat -n -l -p 2>/dev/null | grep "127.0.0.1:4200" > /dev/null 2>&1 ; then
        pid=$(netstat -n -l -p 2>/dev/null | grep "127.0.0.1:4200" | egrep -o "LISTEN +[0-9]+"  | egrep -o "[0-9]+")
        echo "Restarting devApp at :4200 [$pid]"
        kill "$pid"
        "$devdir/node_modules/.bin/ng" serve >/dev/null 2>&1 &
    fi

  # Rename target dir before make
    if [ -e "$targetdir.bak" ] ; then
        rm -rf "$targetdir.bak"
    fi
}

_toolmain "$@"

  # Return to current directory
    cd "$pwd" || exit
