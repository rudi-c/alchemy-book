import * as React from "react"
import * as ReactDOM from "react-dom"

import Editor from "./editor"
import { EditorSocket, UserPresence } from "./editor-socket"

// Yes, React is overkill right now
class Collaborator extends React.Component<any, any> {
    editor: Editor

    constructor() {
        super();

        this.state = { presences: [] };
    }

    presenceCallback = (presences: UserPresence[]) => {
        this.setState({ presences: [...presences] });
        this.editor.updateCursors(presences);
    }

    componentDidMount() {
        const url = window.location.pathname;
        const documentId = url.substring(url.lastIndexOf('/') + 1);
        const editorSocket = new EditorSocket(documentId, this.presenceCallback);
        const textarea = ReactDOM.findDOMNode(this).getElementsByTagName("textarea").item(0);
        this.editor = new Editor(textarea, editorSocket);
    }

    render() {
        // TODO: remove duplicate sites
        const indicators = this.state.presences.map((presence: UserPresence) => 
            <div key={presence.userId}>{ presence.username }</div>
        );
        return (
            <div>
                <div className="indicators">
                    { indicators }
                </div>
                <textarea />
            </div>
        );
    }
}

export default function renderCollaborator(domNode) {
    ReactDOM.render(
        <Collaborator/>,
        domNode
    );
}