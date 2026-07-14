# Django Magic, FastAPI Reality
## Test Isolation at Scale
Maciej Sobczak<!-- .element: style="text-align: right;" class="slim-b" -->

EuroPython 2026 <!-- .element: style="text-align: right;" class="slim-t" -->


notes:
Hello everyone! Today's presentation is about database test isolation. Lets get to it
---

## How to clean up the database between tests?

note:
Some time ago my friend asked my how to clean database between tests in fastapi? He's from rails world where this happens automatically. The same is true for Django. Let's together explore how that works and see if we can recreate that in FastAPI.

---
## Leaky tests

```python [| 2, 6]
def test_create_user(session):
    session.add(User(name="alice"))
    session.commit()

def test_read_user(session):
    user = session.query(User).filter_by(name="alice").one()
    assert user.id == 1
```

note:
Has anyone experienced leaky tests? Scenarios where one test depends on state that was modified by some other test?


---

## No tests isolation
- fragile <!-- .element: class="fragment" -->
- hard to debug <!-- .element: class="fragment" -->
- hard to reason about<!-- .element: class="fragment" -->
- can't be parallelized <!-- .element: class="fragment" -->
- cognitive load <!-- .element: class="fragment" -->

note:
That means there's no tests isolation Test effectively share the state and this can cause problems.
- This makes tests fragile. It breaks when tests are reordered or moved.
- You can run a single test. This is test hard to debug when you have to run whole suite after every change.
- Can't be parallelized
- It make it hard to reason about tests. When a test's setup is unclear, tests no longer serve as documentation.
- Cognitive load shoots up making you more tired faster. On a bad day it might be hard to solve simple issues.

---

## Database test isolation
Database cleanup between tests <!-- .element: class="fragment" -->

note:
There are many ways tests can break the isolation, but database test isolation or in english `Database cleanup between tests`

---

## What we won't talk about

- Tests and isolation best practices <!-- .element: class="fragment" -->
- Django vs FastAPI <!-- .element: class="fragment" -->
- How to make tests faster <!-- .element: class="fragment" -->

note:
- we won't talk about what proper testing looks like. Some of us can't make groundbreaking change to their codebases
- Spoiler alert, both are fine. Those happen to implement isolation differently making a good examples
- well, we kinda will. Also about making them slower. I hope at the end tradeoffs will be obvious. But isolation strategy is not the only avenue to make your tests faster

---

## What on the menu

- test clients <!-- .element: class="fragment" -->
- Django test isolation <!-- .element: class="fragment" -->
- FastAPI test isolation <!-- .element: class="fragment" -->
- isolation patterns <!-- .element: class="fragment" -->


notes:
- test clients
- how django achieves test isolation
- how we can implement it in fastapi
- whats else we can choose

We won't talk about what proper testing should look like or debate wheather Django or FastAPI are better
Spoiler alert, both are fine. Those happen to implement isolation differently making a good examples.
We'll talk about performance but keep in mind event the fastest isolation strategy it not the only how to make your tests faster.

---

## Tale of 2 clients

note:
Believe or not we will start with test clients. What is a test client?

---
FastAPI test client

```python [1-8| 6-8]
from fastapi.testclient import TestClient

client = TestClient(app)

def test_hello():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"msg": "Hello World"}
```

note:
This is a simple fastapi test client. It looks like http clients such as requests or http.
This is no surprise, after all you use it to test your application response for given request.

---

# Disclaimer

note:
Have to make a disclaimer here. As much I would love to show you all source code there is it would make you ask for the refund, so most will be redacted to fit the presentation.

---
FastAPI test client
```python [| 3| 6]
import httpx

class TestClient(httpx.Client):

    def __init__(self, app: ASGIApp):
        transport = ASGITransport(app)

        super().__init__(transport=transport)
```

note:
Simply speaking fastapi test client is just a httpx client, that uses different transport.

---
<div style="display: inline-block;">

Custom Transport object is used to perform the actual sending of the requests.

\- httpx docs <!-- .element: style="text-align: right;" class="slim-t" -->

</div>

note:
By default httpx uses HTTP transport to handle request. So client works the same, just way it "sends" request change.

---

## FastAPI test client

<div data-svg-embed="asgi.svg"></div>

note:
Going into details on how ASGI works is outside of the scope today, so let's try to put everything together

- Fastapi test client is a normal HTTPX client
- sending request is just an python function call using ASGI interface
- request land in your app, the same way as normal request would
- goes through middlewares, depedencies (where you would start your database session)
- and again, using ASGI protocol it returns response, which is again, just a python function call

Only difference to production flow is instead of test client on the left, it would be uvicorn.

---

## Django test client

```python []
>>> from django.test import Client
>>> c = Client()
>>> response = c.post("/login/", {"username": "john", "password": "smith"})
>>> response.status_code
200
>>> response = c.get("/customer/details/")
>>> response.content
b'<!DOCTYPE html...'
```

note:
We just saw FastAPI test client that is pretty normal HTTP client. This looks pretty similar. Spoiler alert: it is different.

---

## Django test client

```python [|4-8|9]
class Client:

    def get(self, path, headers=None, query_params=None, **extra):
        r = {
            "PATH_INFO": self._get_path(path),
            ...
        }

        request = self.create_request(**r)
        response = self.handler(request)

        return response
```

note:

30min temp: ~6min

This source is super simplified, but original meaning is still there. This is GET method of client
- prepares request info
- creates request object, which is a subclass of request you normally get in the view
- call handlers that takes request and returns response

Until now FastAPI and Django test clients differs mostly by plumbing. Lest drill down into the handler.

---

## Django test client

```python [|5-6 | 8]
class ClientHandler(BaseHandler):

    def __call__(self, request):

        urlconf = self.get_urlconf()
        view = urlconf.resolve_view(request.path_info)

        response = view(request)

        return response
```

notes:

That is different though.
- handler gets view function by resolving using url conf
- and then just calls it with request

Django test client doesn't go trough whole request stack. It hooks directly into the app.

---
## Django test client

<div data-svg-embed="django.svg"></div>

notes:
- comparing to the fastapi there is no ASGI to go though
- request doesn't go through the whole app stack, it runs the middlewares (which was omitted in code listing) and then gets response by calling view function

Now we understand how test client hooks into the app request/response pipeline.

---

## Transaction

``` sql [ ]
BEGIN;
    UPDATE accounts SET balance = balance - 100 WHERE id = 1;
    UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
```

notes:

Before we go any further a quick refresher: a transaction is a unit of work the database treats as a single whole. COMMIT makes it permanent, ROLLBACK makes it disappear. All or nothing."

---

## Savepoints

``` sql [| 3, 5 | 7]
BEGIN;
    INSERT INTO table1 VALUES (1);
    SAVEPOINT my_savepoint;
    INSERT INTO table1 VALUES (2);
    ROLLBACK TO SAVEPOINT my_savepoint;
    INSERT INTO table1 VALUES (3);
COMMIT;
```

notes:
Not so common in day to day work. This database feature allows us to discard only part of a transaction.
Very important thing save points can only be used to go backward. Transaction is always committed as whole

---
## Test case

```python [1 | 3| 4 | 6-8 | 3,7 ]
test_case = TestCase()

with transaction.atomic(rollback=True):
    test_case.load_fixtures()

    for test in test_case:
        with transaction.atomic(rollback=True):
            test()
```

notes:
30min temp: ~9:20

To understand how django achieves test isolation we have to take a look inside test case. Implementation specific are not super important so lets stick to the simplified version.

- First we create test case
- then we enter atomic block
- load fixtures, btw, django fixtures are db seeds, initial data, nothing to do with pytest fixtures
- and then each test in wrapped with yet another atomic context manager
- There are 2 atomic() nested, both are marked for rollback

What is atomic's job then?

---

<img src="atomic_django.png" class="r-stretch">

notes:
I have to point out, `Django's Atomic` sounds like crossover between Tarantino’s movie and Fallout tv series - which would be an amazing watch.
Also this not AI, I drew that in paint.

---

## Django atomic

<div data-svg-embed="atomic.svg"></div>

notes:
- left start with outer atomic, on enter is starts new database transaction.
- then inner atomic enters, it creates savepoint in transaction
- we proceed with body
- then exit from outer, depending on łeder atomic was marked for rollback
- if yes, we roll back to the save point, clear all changes done by inner atomic
- if not, we do nothing, we can commit just save, we are still in the transaction, we keep on going
- then we exit outer atomic, and again 2 scenarios
- we either rollback whole transaction, or commit it

This flow works the same no matter how many inner atomic there are.

---

## Django test case

1. testcase - start new transaction <!-- .element: class="fragment" -->
2. loads fixtures <!-- .element: class="fragment" -->
3. test - create new savepoint <!-- .element: class="fragment" -->
4. test run<!-- .element: class="fragment" -->
5. rollback to savepoint <!-- .element: class="fragment" -->
6. rollback transaction <!-- .element: class="fragment" -->

notes:

 when testcase django starts a new transaction
- loads fixtures
- before each test in creates savepoint in transactions
- after test it rolls back to a checkpoint, clearing any db changes made during test
- after whole the test case, rolls back whole transaction clearing loaded fixutres.

But there is something.

---
## No commit

- on commit hook<!-- .element: class="fragment" -->
- deferred constrains <!-- .element: class="fragment" -->
- transaction management <!-- .element: class="fragment" -->
    - skip locked, select for update <!-- .element: class="fragment" -->
    - deadlock handling <!-- .element: class="fragment" -->
    - optimistic locking <!-- .element: class="fragment" -->
- db gone after tests <!-- .element: class="fragment" -->

notes:
There is no commit. Data is never save to database.
We trade speed for features. In this case we loose features related to transactions.

Django has a way of addressing that, but we will get back to that later.

but most importantly

---

## NOT THE SAME AS PRODUCTION

notes:
We're accepting different behavior in test and it production.

---

## FastAPI isolation

```python []
@pytest.fixture()
def test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
```
<!-- .element: class="fragment" -->
notes:

When you try to find how to clean up database between test in fastapi his is the most common answer to the problem you can find. It shows all over articles and templates.

What would we need to implement transaction rollback?

---
## FastAPI transaction rollback

- no commits <!-- .element: class="fragment" -->
- single shared transaction <!-- .element: class="fragment" -->


notes:

First let's establish what we need to do that
- first and most important can't commit transaction in either app or test. We want to roll it back after the test.
- we often check what database changes were made by app. Since we didn't write any data to the database, test has to share one transaction with app so see the changes.

Let's see that we can do about sharing transaction first

---

<div data-svg-embed="asgi2.svg" data-svg-shrink="0.7"></div>

notes:
30min temp: 14:50

By default both test and app are in separate transactions. We need them to share one.

---

## Transaction sharing

```python []
test_session = Session()

def test_db_session():
    return test_session

app.dependency_overrides[db_session] = test_db_session
```

notes:
- solution that comes mind is just to use dependency overrides. And yes, that work. This solves problem of visibility.

Onto the next problem! Commits!

---
## No commit

```python [| 4]
def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(user_create)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj
```

notes:

This is an example from official fastapi template.
There is commit in the middle of the code. And this pattern is all over the fastapi world and there is a good change you have it in your code.

I personally think that this is a terrible idea to commit in the middle of handling request, but the problem here is different.

In SQLAlchemy we can manage transactions ourselves and we DO use that feature. It would be nice to solve that problem without changing whole codebase!

---
## No commit

```python [| 9]
@pytest.fixture
def db_session(engine):
    conn = engine.connect()

    trans = conn.begin()

    sessionmaker.configure(
        bind=conn,
        join_transaction_mode="create_savepoint",
    )

    yield

    trans.rollback()
    conn.close()
```
<!-- .element: class="fit-code" -->

notes:
SQLAlchemy gives us the solution - by changing join_transaction_mode  in sessionmaker.

Such sessions will handle transaction differently. Commits and rollback will use savepoints without us changing any code.

But it can be only used with Session-level abstraction.

---
## No commit

```python [| 9]
with engine.connect() as conn:
    conn.execute(
        some_table.insert(),
        [
            {"data": "some data one"},
            {"data": "some data two"}
        ],
    )
    conn.commit()
```

notes:
And not with core level abstraction which is often used when more speed is required.

This commit with save to the database. To solve this problem, more gymnastics are required. We won't go deeper.

---
## not engineered together

notes:
Why it feel so cumbersome, while django solution just works?

- Fastapi and Sqlalchemy are 2 different libraries developed for different purposes. There is no deeper integration between them and available integrations doesn't implement solution.

---

## Django is not an incident

- transaction handling<!-- .element: class="fragment" -->
- transaction.atomic logic<!-- .element: class="fragment" -->
- integrated test client<!-- .element: class="fragment" -->

notes:

temp 30min: 18:20
As we saw many moving parts has to come together to provide seamless experience in django.

- transaction handling is hidden from developer
- that allows nested atomic blocks to use savepoints without you ever knowing
- test client is build into not build beside. Sharing transaction is no briner.

Those are big architectural decisions going way back, not an afterthought. It was solution engineered from ground up.

---

# Isolation patterns

---
## Schema recreating

<div data-svg-embed="schema_recreate.svg" data-svg-shrink="0.7"></div>

notes:
we aready know this one from fastapi
- before each test be create all tables
- then test runs
- and we drop all tables after
- repeat for every test

---
## Schema recreating

<table class="plus-table">
<tr><th>Pros</th><th>Cons</th></tr>
<tr>
<td>
<ul>
<li class="fragment">really easy to implement</li>
<li class="fragment">no corner cases</li>
<li class="fragment">it is a nuclear option</li>
</ul>
</td>
<td>
<ul>
<li class="fragment">speed</li>
<li class="fragment">it is nuclear option</li>
</ul>
</td>
</tr>
</table>

notes:
 - it is slow
 - everything goes, so we take even more performance hit when db seed is bigger

---

## Transaction wrapping

<div data-svg-embed="transaction-wrapping.svg"></div>

notes:
- we start transaction at the start of test case
- load db fixutres
- before test we create savepoint
- run test test
- rollback to savepoint
- this repeats for every test
- rollback transaction

---
## Transaction wrapping

<table class="plus-table">
<tr><th>Pros</th><th>Cons</th></tr>
<tr>
<td>
<ul>
<li class="fragment">speed</li>
<li class="fragment">seed is not removed</li>
</ul>
</td>
<td>
<ul>
<li class="fragment">feature parity</li>
<li class="fragment">harder to implement</li>
<li class="fragment">async SQLAlchemy</li>
</ul>
</td>
</tr>
</table>

notes:
It is almost the fastest solution. First of all, we load fixures once per test case. Transactions and rollbacks are bread and butter of SQL databases, it is THE "A" in ACID


- we already talked about most on them before.
- we loose features related to transaction management, if having those is a must, some test may have to use different pattern
- as we saw it is hard to implement correctly and cover all corner cases.
- async SQLAlchemy will require different, async test client

---

## Table truncating

<div data-svg-embed="truncate.svg" data-svg-shrink="0.55"></div>

notes:
Truncating is like deleting but faster.
It removes all records from table leaving constraints and indexes.
In order to achieve isolation truncate all tables after each test

---
## Table truncating

<table class="plus-table">
<tr><th>Pros</th><th>Cons</th></tr>
<tr>
<td>
<ul>
<li class="fragment">faster than schema recreating</li>
<li class="fragment">easy implementation</li>
</ul>
</td>
<td>
<ul>
<li class="fragment">seed is gone</li>
<li class="fragment">"restarts" only the data</li>
</ul>
</td>
</tr>
</table>

notes:
- performance will take hit if you need to load seed
- for example can you still have to refresh your materialized views to empty them

---

## Data namespacing

<div data-svg-embed="sharding_db.svg" data-svg-shrink="0.6"></div>

notes:
This is when isolation comes from data itself. Happens naturally in multi-tenant databases. For example when you have a customers and every piece of data clearly belongs to one of them. You don't have clean anything up after test, since customers shouldn't see each others data anyway. We can call it customer/tenant per test.

---
## Data namespacing

<div data-svg-embed="sharding_test.svg" data-svg-shrink="0.7"></div>

notes:
- for every test we create new tenant
- run the test
- there is no need for cleanup, tenants shouldn't see each other's data

---

## Data namespacing

<table class="plus-table">
<tr><th>Pros</th><th>Cons</th></tr>
<tr>
<td>
<ul>
<li class="fragment">speed</li>
<li class="fragment">easy implementation</li>
<li class="fragment">tests tenant isolation for free</li>
</ul>
</td>
<td>
<ul>
<li class="fragment">schema dependent</li>
</ul>
</td>
</tr>
</table>

notes:

tempo 30min: 25

- there are no extra steps for isolation
- easy implementation
- You test will brake if tenants can see each other's data. You get that tested for free.

- Not every project is suited for this approach. Parts of app admin panel will require different approach so hybrid solution might be necessary

---

## Postgres template database

```sql []
CREATE DATABASE test TEMPLATE template0 STRATEGY = FILE_COPY;
```

notes:

It is postgres only. It allows to prepare template database beforehand and create new database by copying it with all schema and data.

---

## Postgres template database

<div data-svg-embed="template_db.svg"></div>

notes:

- so idea is to create such template database at the start of testing session
- create tables
- and load seed data
- with this setup we can just clone template database with tables and data ready
- run test
- and drop test database, or not, we can clean that later

---

## Postgres template database

<table class="plus-table">
<tr><th>Pros</th><th>Cons</th></tr>
<tr>
<td>
<ul>
<li class="fragment">faster then recreating schema</li>
<li class="fragment">seed stays between tests</li>
</ul>
</td>
<td>
<ul>
<li class="fragment">postgres only</li>
<li class="fragment">needs more permissions</li>
<li class="fragment">connection management complexity</li>
</ul>
</td>
</tr>
</table>

notes:
- this is like to schema recreation but if extra steps for performance. We copy files on disk instead of recreating tables.

- unfortunately this feature exists only in postgres. MSSQL has something similar. And of course you can copy sqlite files.

- it needs permissions create database, which is not available in all cloud solutions
- There are caveats around connection management, that don't show elsewhere


---
## Your milage may vary

800 tests, 28 tables, 184 columns
<div data-svg-embed="benchmark.svg" data-svg-shrink="0.8"></div>

---
## Your milage may vary

800 tests, 28 tables, 184 columns
<div data-svg-embed="benchmark2.svg" data-svg-shrink="0.8"></div>


notes:

This graph shows time of running testcase with 800 tests. Fastapi, sqlalchemy, pytest, postgres.

Transaction rollback and data namespacing are clear winners. Then truncate not that far off, clearly faster then template db. And as we thought schema recreating dead last.

Look what happen when there is a seed data. Truncating takes massive hit because it loads data before each tests and template db pulls ahead.


It is really tricky to provide universal benchmark. There are no two identical setups, different amount of tests, seed size, different database setup, different machine. Some strategies may not be feasible in your setup.

Try, experiment and measure. See what works for you.

---
# Trade offs

notes:
Most of things in IT is about trade-off. Without knowing them what seems to be the best solution might become a nightmare in a couple of months. Understanding the problem will help you choose solution for you.

---
# Not only python

notes:
Even though we talked in context of python and couple of frameworks this knowledge is transferable to other stacks and languages. That's because underlying concepts are the same.

---

# Thank you!

https://nbit.blog


---

# QA

---

