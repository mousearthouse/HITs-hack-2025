FROM postgres:16

ENV POSTGRES_DB=tasks_db \
    POSTGRES_USER=tasks_user \
    POSTGRES_PASSWORD=strongpassword

COPY init.sql /docker-entrypoint-initdb.d/