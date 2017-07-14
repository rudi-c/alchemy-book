import * as React from "react"
import * as ReactDOM from "react-dom"

import Test from "./test"

import CodeMirror from "react-codemirror"

require('codemirror/lib/codemirror.css');

class Editor extends React.Component {
    render() {
        // var test: string = "test"
        return (<h1>Hello World!</h1>)
    }
}

export default function renderEditor(domNode) {
    ReactDOM.render(
        (<div>
            <Editor/>
            <Test />
            <CodeMirror value="test"
            options={{lineNumbers: true}} />
         </div>),
        domNode
    )
}
