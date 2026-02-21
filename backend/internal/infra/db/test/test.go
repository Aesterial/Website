package dbtest

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Init(DB *pgxpool.Pool) error {
	var err error
	if err = pingTest(DB); err != nil {
		return err
	}
	if err = queryTest(DB); err != nil {
		return err
	}
	return nil
}

func pingTest(DB *pgxpool.Pool) error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*3)
	defer cancel()
	if err := DB.Ping(ctx); err != nil {
		return err
	}
	return nil
}

func queryTest(DB *pgxpool.Pool) error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*3)
	defer cancel()
	tx, err := DB.BeginTx(ctx, pgx.TxOptions{
		AccessMode: pgx.ReadOnly,
	})
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()
	var one int
	if err = tx.QueryRow(ctx, "SELECT 1").Scan(&one); err != nil {
		return err
	}
	return nil
}
