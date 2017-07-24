defmodule AlchemyBook.DocumentChannel do
    use AlchemyBook.Web, :channel

    alias AlchemyBook.Document
    alias AlchemyBook.DocumentRegistry
    alias AlchemyBook.DocumentSession

    intercept ["change"]

    def join("documents:" <> document_id, _params, socket) do
        send(self(), :after_join)
        {:ok, assign(socket, :document_id, String.to_integer(document_id))}
    end

    def handle_in("change", params, socket) do
        IO.puts inspect params
        broadcast! socket, "change", %{
            userId: socket.assigns.user_id,
            # TODO: probably should do some input validation
            change: params["change"],
            lamport: params["lamport"]
        }
        {:reply, :ok, socket}
    end

    def handle_out("change", payload, socket) do
        # Don't send a change event to the originator of the change event
        if payload[:userId] != socket.assigns.user_id do
            push socket, "change", payload
        end
        {:noreply, socket}
    end

    def handle_info(:after_join, socket) do
        doc_session = DocumentRegistry.lookup(socket.assigns.document_id)

        init_value = 
            DocumentSession.get(doc_session)
            |> Document.crdt_to_json_ready
        
        site = DocumentSession.request_site_for_user(doc_session, socket.assigns.user_id)

        push socket, "init", %{ state: init_value, site: site }
        {:noreply, socket}
    end
end