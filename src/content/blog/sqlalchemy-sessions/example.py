from typing import Annotated, Generator

from fastapi import Depends, FastAPI
from pydantic import BaseModel
from sqlalchemy import String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


class Base(DeclarativeBase):
    pass


class Hero(Base):
    __tablename__ = "hero"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String())
    age: Mapped[int]
    secret_name: Mapped[str]


class HeroModel(BaseModel):
    id: int | None  # for example brevity
    name: str
    age: int
    secret_name: str

    class Config:
        from_attributes = True


sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args, echo=True)


def create_db_and_tables():
    Base.metadata.create_all(engine)


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        with session.begin():
            yield session


SessionDep = Annotated[Session, Depends(get_db)]

app = FastAPI()


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.post("/heroes/")
def create_hero(hero: HeroModel, session: SessionDep) -> HeroModel:
    hero = Hero(**hero.model_dump())
    session.add(hero)
    session.flush()
    return HeroModel.model_validate(hero)
