defmodule AlchemyBook.DocumentChannel do
    use AlchemyBook.Web, :channel

    alias AlchemyBook.Presence

    alias AlchemyBook.User
    alias AlchemyBook.Document
    alias AlchemyBook.DocumentRegistry
    alias AlchemyBook.DocumentSession

    intercept ["change"]

    def join("documents:" <> document_id, _params, socket) do
        send(self(), :after_join)
        {:ok, assign(socket, :document_id, String.to_integer(document_id))}
    end

    def handle_in("change", params, socket) do
        change = parse_change(params["change"])

        DocumentRegistry.lookup(socket.assigns.document_id)
        |> DocumentSession.update(change)

        broadcast! socket, "change", %{
            userId: socket.assigns.user_id,
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

        handle_presence(socket)

        {:noreply, socket}
    end

    def handle_presence(socket) do
        Presence.track(socket, socket.assigns.user_id, %{
            online_at: :os.system_time(:milli_seconds),
            username: Repo.get!(User, socket.assigns.user_id).username
        })
        push socket, "presence_state", Presence.list(socket)
    end

    defp parse_change([type, char]) do
        position = 
            char["position"]
            |> Enum.map(fn %{"pos" => pos, "site" => site} -> {pos, site} end)
        [type, { { position, char["lamport"] }, char["value"] }]
    end
end