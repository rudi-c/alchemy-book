defmodule AlchemyBook.Document do
  use AlchemyBook.Web, :model

  @crdt_base 256
  @default_site 0

  schema "documents" do
    field :title, :string
    field :contents, :string
    belongs_to :user, AlchemyBook.User

    timestamps()
  end

  @doc """
  Builds a changeset based on the `struct` and `params`.
  """
  def changeset(struct, params \\ %{}) do
    struct
    |> cast(params, [:title, :contents])
    #|> validate_required([:title, :contents])
  end

  def default() do
    %{ "title" => "untitled", 
       "contents" => crdt_to_json(string_to_crdt("Time to do some alchemy!\nReady to have some fun?"))
    }
  end

  def json_to_crdt(json) do
    json
    |> Poison.decode!
    |> Enum.map(fn [position_identifier, lamport, char] ->
      {Enum.map(position_identifier, fn [digit, site] -> {digit, site} end), lamport, char}
    end)
  end

  def crdt_to_json(crdt) do 
    crdt_to_json_ready(crdt)
    |> Poison.encode!
  end

  def crdt_to_json_ready(crdt) do 
    IO.puts inspect crdt
    crdt
    |> Enum.map(fn {position_identifier, lamport, char} ->
      [Enum.map(position_identifier, fn {digit, site} -> [digit, site] end), lamport, char]
    end)
  end

  defp string_to_crdt(string) do
    # TODO: support for bigger strings
    # (right now this is used only for the default string)
    if String.length(string) >= @crdt_base do
      throw "no supported yet"
    end

    string
    |> String.to_charlist
    |> Enum.with_index
    |> Enum.map(fn {char, index} ->
      identifier = { trunc(index / String.length(string) * @crdt_base) + 1, @default_site }
      { [identifier], index, to_string([char]) }
    end)
  end
end
