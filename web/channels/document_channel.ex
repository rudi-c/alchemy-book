defmodule AlchemyBook.DocumentChannel do
    use AlchemyBook.Web, :channel

    intercept ["change"]

    def join("documents:" <> document_id, _params, socket) do
        {:ok, assign(socket, :document_id, String.to_integer(document_id))}
    end

    def handle_in("change", params, socket) do
        IO.puts inspect params
        broadcast! socket, "change", %{
            user_id: socket.assigns.user_id,
            # TODO: probably should do some input validation
            change: params
        }
        {:reply, :ok, socket}
    end

    def handle_out("change", payload, socket) do
        # Don't send a change event to the originator of the change event
        if payload[:user_id] != socket.assigns.user_id do
            push socket, "change", payload
        end
        {:noreply, socket}
    end
end