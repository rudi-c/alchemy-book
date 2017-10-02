defmodule AlchemyBook.DocumentChannel do
    use AlchemyBook.Web, :channel

    alias AlchemyBook.Presence

    alias AlchemyBook.User
    alias AlchemyBook.Document
    alias AlchemyBook.DocumentRegistry
    alias AlchemyBook.DocumentSession

    intercept ["change"]

    def join("documents:" <> slug, _params, socket) do
        {:ok, [document_id]} = Document.id_from_slug(slug)
        site_id =
            DocumentRegistry.lookup(document_id)
            |> DocumentSession.request_site_for_user(socket.assigns.user_id)

        socket =
            socket
            |> assign(:document_id, document_id)
            |> assign(:site_id, site_id)

        send(self(), :after_join)
        {:ok, socket}
    end

    def handle_in("change", params, socket) do
        change = parse_change(params["change"])

        DocumentRegistry.lookup(socket.assigns.document_id)
        |> DocumentSession.update(change)

        broadcast! socket, "change", %{
            siteId: socket.assigns.site_id,
            change: params["change"],
            lamport: params["lamport"]
        }

        {:reply, :ok, socket}
    end

    def handle_in("cursor", params, socket) do
        Presence.update(socket, socket.assigns.site_id, fn meta ->
            %{ meta | cursor: %{ line: params["line"], ch: params["ch"] } }
        end)
        {:reply, :ok, socket}
    end

    def handle_out("change", payload, socket) do
        # Don't send a change event to the originator of the change event
        if payload[:siteId] != socket.assigns.site_id do
            push socket, "change", payload
        end
        {:noreply, socket}
    end

    def terminate(reason, socket) do
        if Dict.size(Presence.list(socket)) <= 1 do
            # Last connection
            DocumentRegistry.close(socket.assigns.document_id)
        end
    end

    def handle_info(:after_join, socket) do
        init_value =
            DocumentRegistry.lookup(socket.assigns.document_id)
            |> DocumentSession.get
            |> Document.crdt_to_json_ready

        push socket, "init", %{ state: init_value, site: socket.assigns.site_id }

        handle_presence(socket)

        {:noreply, socket}
    end

    def handle_presence(socket) do
        color =
            DocumentRegistry.lookup(socket.assigns.document_id)
            |> DocumentSession.request_color_for_user(socket.assigns.user_id)

        Presence.track(socket, socket.assigns.site_id, %{
            color: color,
            cursor: nil,
            online_at: :os.system_time(:milli_seconds),
            user_id: socket.assigns.user_id,
            username: Repo.get!(User, socket.assigns.user_id).username
        })

        push socket, "presence_state", Presence.list(socket)
    end

    defp parse_change([type, char]) do
        position =
            char["position"]
            |> Enum.map(fn %{"digit" => digit, "site" => site} -> {digit, site} end)
        [type, { { position, char["lamport"] }, char["value"] }]
    end
end