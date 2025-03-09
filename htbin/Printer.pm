package Printer;

use strict;
use warnings;
use utf8;
use feature qw(signatures);
no warnings qw(experimental::signatures);

sub list($directory, $files) {
    my $rows = '';

    if ($directory ne '/') {
        $rows .= qq{
            <tr>
                <td valign="top">⬆️</td>
                <td><a href="..">Parent Directory</a></td>
                <td>&nbsp;</td>
                <td align="right">-</td>
                <td>&nbsp;</td>
            </tr>
        };
    }

    # (2) Add one table row per file
    #     The $files hash keys are filenames; each value is a hashref with
    #     (permissions, owner, group, size, date, type, symlink_target, etc.)
    FILE_LOOP:
    for my $name (sort keys %$files) {
        my $info = $files->{$name};
        my $file_type = $info->{type} || '';

        # Pick a symbol based on file type or extension
        my $symbol = '📄';              # default for a regular file
        if ($file_type eq 'directory') {
            $symbol = '📁';
        }
        elsif ($file_type eq 'symlink') {
            $symbol = '🔗';
        }
        elsif ($name =~ /\.(?:tar\.gz|tgz|zip|gz|bz2|xz)$/i) {
            $symbol = '🗜';  # compressed file
        }

        # Skip the ".." entry if we already handled it as a “Parent Directory” row above
        next FILE_LOOP if $name eq '..';

        # Make the name into a link
        # If it’s a directory, you might want a trailing slash, like "foo/"
        my $display_name = $name;
        $display_name .= '/' if $file_type eq 'directory';

        my $date = $info->{date} || '';
        my $size = $info->{size} || '-';

        $rows .= qq{
            <tr>
                <td valign="top">$symbol</td>
                <td><a href="$name">$display_name</a></td>
                <td align="right">$date</td>
                <td align="right">$size</td>
                <td>&nbsp;</td>
            </tr>
        };
    }

    return qq{
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Index of $directory</title>
  </head>
  <body>
    <h1>Index of $directory</h1>
    <table>
      <tr>
        <th></th>
        <th>Name</th>
        <th>Last modified</th>
        <th>Size</th>
        <th>Description</th>
      </tr>
      <tr><th colspan="5"><hr></th></tr>

      $rows

      <tr><th colspan="5"><hr></th></tr>
    </table>
  </body>
</html>
    };
}

1;
