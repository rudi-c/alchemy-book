defmodule AlchemyBook.DocumentControllerTest do
  use AlchemyBook.ConnCase

  alias AlchemyBook.Document
  @valid_attrs %{contents: "some content", title: "some content"}
  @invalid_attrs %{}

  test "lists all entries on index", %{conn: conn} do
    conn = get conn, document_path(conn, :index)
    assert html_response(conn, 200) =~ "Listing documents"
  end

  test "renders form for new resources", %{conn: conn} do
    conn = get conn, document_path(conn, :new)
    assert html_response(conn, 200) =~ "New document"
  end

  test "creates resource and redirects when data is valid", %{conn: conn} do
    conn = post conn, document_path(conn, :create), document: @valid_attrs
    assert redirected_to(conn) == document_path(conn, :index)
    assert Repo.get_by(Document, @valid_attrs)
  end

  test "does not create resource and renders errors when data is invalid", %{conn: conn} do
    conn = post conn, document_path(conn, :create), document: @invalid_attrs
    assert html_response(conn, 200) =~ "New document"
  end

  test "shows chosen resource", %{conn: conn} do
    document = Repo.insert! %Document{}
    conn = get conn, document_path(conn, :show, document)
    assert html_response(conn, 200) =~ "Show document"
  end

  test "renders page not found when id is nonexistent", %{conn: conn} do
    assert_error_sent 404, fn ->
      get conn, document_path(conn, :show, -1)
    end
  end

  test "renders form for editing chosen resource", %{conn: conn} do
    document = Repo.insert! %Document{}
    conn = get conn, document_path(conn, :edit, document)
    assert html_response(conn, 200) =~ "Edit document"
  end

  test "updates chosen resource and redirects when data is valid", %{conn: conn} do
    document = Repo.insert! %Document{}
    conn = put conn, document_path(conn, :update, document), document: @valid_attrs
    assert redirected_to(conn) == document_path(conn, :show, document)
    assert Repo.get_by(Document, @valid_attrs)
  end

  test "does not update chosen resource and renders errors when data is invalid", %{conn: conn} do
    document = Repo.insert! %Document{}
    conn = put conn, document_path(conn, :update, document), document: @invalid_attrs
    assert html_response(conn, 200) =~ "Edit document"
  end

  test "deletes chosen resource", %{conn: conn} do
    document = Repo.insert! %Document{}
    conn = delete conn, document_path(conn, :delete, document)
    assert redirected_to(conn) == document_path(conn, :index)
    refute Repo.get(Document, document.id)
  end
end
