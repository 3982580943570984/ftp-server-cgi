with import <nixpkgs> { };

pkgs.mkShell {
  buildInputs = [
    perl
    perlPackages.Appcpanminus
  ];
}
