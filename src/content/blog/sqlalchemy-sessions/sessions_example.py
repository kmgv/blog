from typing import Optional

from sqlalchemy import String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "user_account"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(30))
    fullname: Mapped[Optional[str]]


sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args, echo=True)

Base.metadata.create_all(engine)


from sqlalchemy.orm import sessionmaker

Session = sessionmaker(engine)

from contextlib import contextmanager


@contextmanager
def db_session():
    session = Session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


with db_session() as session:
    bob = User(name="Bob", fullname="Robert Smith")
    session.add(bob)
    session.flush()

    print("Bob id is:", bob.id)


with db_session() as session:
    user = session.query(User).filter_by(name="Bob").first()
    print("Bob id is:", user.id)
