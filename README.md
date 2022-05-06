# Terra Scripts

General useful TS scripts for Terra

## Required Environment variables

```
export WALLET="mnemonic"
export LCD_CLIENT_URL=https://bombay-lcd.terra.dev
export CHAIN_ID=bombay-12
```

## Optional Environment variables

```
export ADMIN="terra1..."
```

## Scripts

### `upload_and_init.ts`

1. Contract project is in the home directory
2. Edit `PROJECT` and `initMsg` in the script file
3. Run `ts-node upload_and_init.ts`
