import "phoenix_html"

import renderCollaborator from "./collaborator"

require("codemirror/lib/codemirror.css");

const collaborator = document.getElementById("collaborator");
if (collaborator) {
    renderCollaborator(collaborator);
}
