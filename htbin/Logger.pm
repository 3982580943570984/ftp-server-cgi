package Logger;

use strict;
use warnings;
use utf8;
use feature qw(signatures);
no warnings qw(experimental::signatures);

use CGI::Carp qw(fatalsToBrowser warningsToBrowser);
use Data::Dumper;

sub log($format, @args) { warn sprintf $format, Dumper(\@args); }

1;
