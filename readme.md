```bash
nix-shell
```

```bash
cpanm CGI
```

```settings.json
  "perlnavigator.includePaths": [
    "/home/$USER/perl5/lib/perl5"
  ],
```

```bash
export PERL5LIB=/home/$USER/perl5/lib/perl5:$PERL5LIB
```

```bash
sudo python -m pyftpdlib --port 21 --write --username username --password password
```

```bash
sudo python -m http.server --cgi 80
```