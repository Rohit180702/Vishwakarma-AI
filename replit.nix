{ pkgs }: {
  deps = [
    pkgs.python311
    pkgs.python311Packages.pip
    pkgs.nodejs_20
    pkgs.nodePackages.npm
    # Required by docling for document parsing
    pkgs.libstdcxx5
    pkgs.zlib
    pkgs.libffi
  ];
}
