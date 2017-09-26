# The Alchemy Book

This application is currently "pre-launch", as in the demo is working, but there's still tons of bugs to fix. A blog post on this project is also coming soon.

## Setup

```
mix ecto.create
mix ecto.migrate
```

## Static checking

Use `mix dialyzer` to do static checking with Dialyzer. The first time should take a lot of time as it runs on the dependencies too, although the results will be cached. Note that there are still a lot of (what I think are) spurious warnings. This is to be fixed later.

## Deploying

Create a symbolic link to your `prod.secret.exs` file (and maybe to your deploy script too):

```
ln -s <path>/prod.secret.exs config/prod.secret.exs
```

with

```
config :alchemy_book, AlchemyBook.Endpoint,
  secret_key_base: "<secret key>"

# Configure your database
config :alchemy_book, AlchemyBook.Repo,
  adapter: Ecto.Adapters.Postgres,
  username: "<username>",
  password: "<password>",
  database: "alchemy_book_prod",
  pool_size: 20
```

## Typescript

Install the Typescript compiler and linter globally

```
npm install -g tslint typescript
```

and run the linter with `npm run lint`

## Testing

We use Ava

```
npm install -g ava
```

which you can run with `npm test`
