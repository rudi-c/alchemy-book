defmodule AlchemyBook.DocumentSession do
    def start_link(state) do
        Agent.start_link(fn -> state end)
    end

    def get(session) do
        Agent.get(session, fn state -> state end)
    end

    def update(session, change) do
        Agent.update(session, fn state -> apply_change(state, change) end)
    end

    defp apply_change(state, change) do
        # TODO
        state
    end
end