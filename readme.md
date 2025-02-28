```bash
nix-shell
```

```bash
cpanm CGI
```

```settings.json
  "perlnavigator.includePaths": [
    "/home/nixos/perl5/lib/perl5"
  ],
```

```bash
export PERL5LIB=/home/nixos/perl5/lib/perl5:$PERL5LIB
```

```bash
sudo python -m pyftpdlib --port 21 --write --username username --password password
```