import * as React from "react"
import * as ReactDOM from "react-dom"

import Editor from "./editor"
import EditorSocket from "./editor-socket"

// Yes, React is completely unecessary right now
class Collaborator extends React.Component<any, any> {
    editor: Editor

    componentDidMount() {
        const url = window.location.pathname;
        const documentId = url.substring(url.lastIndexOf('/') + 1);
        const editorSocket = new EditorSocket(documentId);
        this.editor = new Editor(ReactDOM.findDOMNode(this), editorSocket);
    }

    render() {
        return (<textarea />);
    }
}

export default function renderCollaborator(domNode) {
    ReactDOM.render(
        <Collaborator/>,
        domNode
    );
}