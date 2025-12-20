package dbtest

import (
	"context"
	"database/sql"
	"time"
)

func Init(DB *sql.DB) error {
	var err error
	if err = pingTest(DB); err != nil {
		return err
	}
	if err = queryTest(DB); err != nil {
		return err
	}
	return nil
}

func pingTest(DB *sql.DB) error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*3)
	defer cancel()
	if err := DB.PingContext(ctx); err != nil {
		return err
	}
	return nil
}

func queryTest(DB *sql.DB) error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*3)
	defer cancel()
	tx, err := DB.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return err
	}
	var one int
	if err = tx.QueryRowContext(ctx, "SELECT 1").Scan(&one); err != nil {
		return err
	}
	return nil
}
