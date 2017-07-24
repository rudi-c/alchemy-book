defmodule AlchemyBook.DocumentSession do
    def start_link(crdt) do
        # The server is always site 0 by convention
        # TODO: an ordered map would be ideal if we expect thousands of sites
        Agent.start_link(fn -> {crdt, [{0, nil}]} end)
    end

    def get(session) do
        Agent.get(session, fn {crdt, _} -> crdt end)
    end

    def update(session, change) do
        Agent.update(session, fn {crdt, sites} -> {apply_change(crdt, change), sites} end)
    end

    def request_site_for_user(session, user_id) do
        Agent.get_and_update(session, fn {crdt, sites} ->
            [{latest_site, _} | _] = sites
            next_sites = [{latest_site + 1, user_id} | sites]
            {latest_site + 1, {crdt, next_sites}}
        end)
    end

    defp apply_change(crdt, change) do
        # TODO
        crdt
    end
end