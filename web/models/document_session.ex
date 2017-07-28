defmodule AlchemyBook.DocumentSession do
    require Logger

    def start_link(crdt) do
        # The server is always site 0 by convention
        # TODO: an ordered map would be ideal if we expect thousands of sites
        Agent.start_link(fn -> {crdt_as_map(crdt), [{0, nil}]} end)
    end

    def get(session) do
        Agent.get(session, fn {crdt_map, _} -> crdt_from_map(crdt_map) end)
    end

    def update(session, change) do
        Agent.update(session, fn {crdt_map, sites} -> 
            {apply_change(crdt_map, change), sites} 
        end)
    end

    def request_site_for_user(session, user_id) do
        Agent.get_and_update(session, fn {crdt_map, sites} ->
            [{latest_site, _} | _] = sites
            next_sites = [{latest_site + 1, user_id} | sites]
            {latest_site + 1, {crdt_map, next_sites}}
        end)
    end

    defp apply_change(crdt_map, ["add", {char, value}]) do
        if Map.has_key?(crdt_map, char) && Map.get(crdt_map, char) != value do
            Logger.error "Map already has key #{char} with different value"
        end
        Map.put(crdt_map, char, value)
    end

    defp apply_change(crdt_map, ["remove", {char, _value}]) do
        Map.delete(crdt_map, char)
    end

    defp crdt_as_map(crdt) do
        crdt
        |> Enum.map(fn {identifier, lamport, char} -> {{identifier, lamport}, char} end)
        |> Map.new
    end

    defp crdt_from_map(crdt_map) do
        Map.to_list(crdt_map)
        |> Enum.sort(fn (a, b) -> compare_char(a, b) end)
        |> Enum.map(fn {{identifier, lamport}, char} -> {identifier, lamport, char} end)
    end

    defp compare_char({{position1, _lamport1}, _v1}, {{position2, _lamport2}, _v2}) do
        compared =
            Stream.zip(position1, position2)
            |> Stream.map(fn {i1, i2} -> compare_identifier(i1, i2) end)
            |> Enum.find(fn compared -> compared != :equal end)
        
        cond do
            compared != nil -> compared
            length(position1) <= length(position2) -> true
            true -> false
        end
    end

    defp compare_identifier({pos1, site1}, {pos2, site2}) do
        cond do
            pos1 < pos2 -> true
            pos1 > pos2 -> false
            site1 < site2 -> true
            site1 > site2 -> false
            true -> :equal 
        end
    end
end