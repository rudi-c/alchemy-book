defmodule AlchemyBook.DocumentSession do
    require Logger

    alias AlchemyBook.DocumentSession

    @seconds_between_saves 5
 
    # From https://stackoverflow.com/questions/1168260/algorithm-for-generating-unique-colors
    # With black removed
    @colors [
        "#006401",
        "#010067",
        "#95003A",
        "#007DB5",
        "#FF00F6",
        "#FFEEE8",
        "#774D00",
        "#90FB92",
        "#0076FF",
        "#D5FF00",
        "#FF937E",
        "#6A826C",
        "#FF029D",
        "#FE8900",
        "#7A4782",
        "#7E2DD2",
        "#85A900",
        "#FF0056",
        "#A42400",
        "#00AE7E",
        "#683D3B",
        "#BDC6FF",
        "#263400",
        "#BDD393",
        "#00B917",
        "#9E008E",
        "#001544",
        "#C28C9F",
        "#FF74A3",
        "#01D0FF",
        "#004754",
        "#E56FFE",
        "#788231",
        "#0E4CA1",
        "#91D0CB",
        "#BE9970",
        "#968AE8",
        "#BB8800",
        "#43002C",
        "#DEFF74",
        "#00FFC6",
        "#FFE502",
        "#620E00",
        "#008F9C",
        "#98FF52",
        "#7544B1",
        "#B500FF",
        "#00FF78",
        "#FF6E41",
        "#005F39",
        "#6B6882",
        "#5FAD4E",
        "#A75740",
        "#A5FFD2",
        "#FFB167",
        "#009BFF",
        "#E85EBE",
        "#00FF00",
        "#0000FF",
        "#FF0000",
        "#01FFFE",
        "#FFA6FE",
        "#FFDB66",
    ]

    @type position :: list({integer, integer})
    @type position_identifier :: {position, integer}
    @type crdt :: list({position, integer, String.t})
    @type crdt_map :: %{required(position_identifier) => String.t}

    defstruct document_id: -1, crdt: %{}, sites: [], color_assign: %{}, last_update: 0, last_save: 0

    @spec start_link(integer, crdt) :: {:ok, pid()}
    def start_link(document_id, crdt) do
        now = :os.system_time(:millisecond)
        # The server is always site 0 by convention
        # TODO: an ordered map would be ideal if we expect thousands of sites
        {:ok, session} = Agent.start_link(fn -> 
            %DocumentSession{document_id: document_id,
                             crdt: crdt_as_map(crdt), 
                             sites: [{0, nil}], 
                             color_assign: %{},
                             last_update: now, 
                             last_save: now} 
        end)

        # Save the file every few seconds as needed
        :timer.apply_interval(:timer.seconds(@seconds_between_saves), DocumentSession, :save, [session])

        {:ok, session}
    end

    @spec save(pid) :: no_return
    def save(session) do
        {document_id, last_update, last_save} = Agent.get(session, fn session -> 
            {session.document_id, session.last_update, session.last_save} 
        end)
        now = :os.system_time(:millisecond)
        if last_save < last_update do
            crdt = get(session)
            AlchemyBook.DocumentController.save(document_id, crdt)
            Agent.update(session, fn session -> %{ session | last_save: now } end)
        end
    end

    @spec get(pid) :: crdt
    def get(session) do
        Agent.get(session, fn %DocumentSession{crdt: crdt_map} -> 
            crdt_from_map(crdt_map) 
        end)
    end

    @spec update(pid, {String.t, {position_identifier, String.t}}) :: no_return
    def update(session, change) do
        Agent.update(session, fn session = %DocumentSession{crdt: crdt_map} -> 
            %{ session | 
                crdt: apply_change(crdt_map, change),
                last_update: :os.system_time(:millisecond)
            } 
        end)
    end

    @spec request_site_for_user(pid, integer) :: integer
    def request_site_for_user(session, user_id) do
        Agent.get_and_update(session, fn session = %DocumentSession{sites: sites} ->
            # Note: we have no garbage collection mechanism right now for sites
            # Unlikely to be a problem.
            [{latest_site, _} | _] = sites
            next_sites = [{latest_site + 1, user_id} | sites]
            { latest_site + 1, %{ session | sites: next_sites} }
        end)
    end

    @spec request_color_for_user(pid, integer) :: String.t
    def request_color_for_user(session, user_id) do
        Agent.get_and_update(session, fn session = %DocumentSession{color_assign: colors} ->
            if Map.has_key?(colors, user_id) do
                { Map.get(colors, user_id), session }
            else
                color = if map_size(colors) >= length(@colors) do
                    # If we've ran out of colors, just using random ones
                    Enum.at(@colors, :rand.uniform(length(@colors)) - 1)
                else
                    Enum.at(@colors, map_size(colors))
                end
                { color, %{ session | color_assign: Map.put(colors, user_id, color) } }
            end
        end)
    end

    @spec apply_change(crdt_map, {String.t, {position_identifier, String.t}}) :: crdt_map
    defp apply_change(crdt_map, {"add", {char, value}}) do
        if Map.has_key?(crdt_map, char) && Map.get(crdt_map, char) != value do
            Logger.error "Map already has key #{char} with different value"
        end
        Map.put(crdt_map, char, value)
    end
    defp apply_change(crdt_map, ["remove", {char, _value}]) do
        Map.delete(crdt_map, char)
    end

    @spec crdt_as_map(crdt) :: crdt_map
    defp crdt_as_map(crdt) do
        crdt
        |> Enum.map(fn {identifier, lamport, char} -> {{identifier, lamport}, char} end)
        |> Map.new
    end

    @spec crdt_from_map(crdt_map) :: crdt
    defp crdt_from_map(crdt_map) do
        Map.to_list(crdt_map)
        |> Enum.sort(fn (a, b) -> compare_char(a, b) end)
        |> Enum.map(fn {{identifier, lamport}, char} -> {identifier, lamport, char} end)
    end

    @spec compare_char({position_identifier, String.t}, {position_identifier, String.t}) :: boolean
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

    @spec compare_identifier({integer, integer}, {integer, integer}) :: boolean | :equal
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