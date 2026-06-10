create table controle_sync (
  id serial primary key,
  ultimo_indice integer
);

insert into controle_sync (ultimo_indice) values (0);