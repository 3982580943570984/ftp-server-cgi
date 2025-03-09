#!/usr/bin/env perl

use strict;
use warnings;

use FindBin;
use lib $FindBin::Bin;

require Handler;

my $handler = Handler->new();

eval { $handler->handle(); };

$handler->send({ error => $@ }, 500) if $@;
