defmodule AlchemyBook.DocumentTest do
  use AlchemyBook.ModelCase

  alias AlchemyBook.Document

  @valid_attrs %{contents: "some content", title: "some content"}
  @invalid_attrs %{}

  test "changeset with valid attributes" do
    changeset = Document.changeset(%Document{}, @valid_attrs)
    assert changeset.valid?
  end

  test "changeset with invalid attributes" do
    changeset = Document.changeset(%Document{}, @invalid_attrs)
    refute changeset.valid?
  end
end
