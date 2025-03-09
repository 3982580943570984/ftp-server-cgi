package Ftp;

use strict;
use warnings;
use utf8;
use feature qw(signatures);
no warnings qw(experimental::signatures);

use CGI::Carp qw(fatalsToBrowser);
use Data::Dumper;
use IO::String;
use Net::FTP;

require Logger;

sub new(
  $class,
  $host = "127.0.0.1",
  $port = 21,
  $username = "username",
  $password = "password"
) {
  my $self = bless { inner => undef, directory => "" }, $class;

  $self->{inner} = Net::FTP->new(Host => $host, Port => $port, Passive => 1)
    or die "Не удалось подключиться к FTP серверу: $@";

  $self->{inner}->login($username, $password)
    or die "Не удалось авторизоваться: " . $self->{inner}->message;

  return $self;
}

sub directory($self, $directory = $self->{directory}) {
  if ($directory eq $self->{directory}) { return $self->{directory}; }

  Logger::log("Изменение текущей директории '%s' на '%s'", [$self->{directory}, $directory]);

  $self->cwd($directory);

  return $self->{directory};
}

sub listing($self, $directory = $self->{directory}) {
  my %files;

  for my $file ($self->dir($directory)) {
    if ($file =~ m{
      ^([dl-][rwx-]+)\s+      # Permissions
      (\d+)\s+                # Hard links
      (\S+)\s+                # Owner
      (\S+)\s+                # Group
      (\d+)\s+                # Size
      (\w{3})\s+              # Month
      (\d{1,2})\s+            # Day
      (\d{2}:\d{2}|\d{4})\s+  # Time or Year
      (.+?)$                  # Filename (incl. symlink target)
    }x) {
      my (
        $permissions,
        $links,
        $owner,
        $group,
        $size,
        $month,
        $day,
        $time_or_year,
        $filename
      ) = ($1, $2, $3, $4, $5, $6, $7, $8, $9);

      my $type = substr($permissions, 0, 1);

      $files{$filename} = {
        permissions => $permissions,
        links => $links,
        owner => $owner,
        group => $group,
        size => $size,
        date => "$month $day $time_or_year",
        type => $type eq 'd' ? 'directory' : $type eq 'l' ? 'symlink' : 'file',
      };

      my $is_symlink = ($type eq 'l' && $filename =~ /(.*) -> (.*)/);
      if ($is_symlink) {
        $files{$1}->{symlink_target} = $2;
      }
    }
  }

  return \%files;
}

sub get($self, $directory, $filename, $output = IO::String->new) {
  $self->directory($directory);

  $self->{inner}->get($filename, $output)
    or die "Не удалось получить файл из активной директории: " . $self->{inner}->message;

  return ${$output->string_ref};
}

sub put($self, $directory, $filename, $contents) {
  $self->directory($directory);

  $self->{inner}->put($contents, $filename)
    or die "Не удалось загрузить файл в активную директорию: " . $self->{inner}->message;
}

sub cwd($self, $directory) {
  $self->{inner}->cwd($directory)
    or die "Не удалось изменить активную директорию: " . $self->{inner}->message;

  $self->{directory} = $self->pwd();
}

sub pwd($self) {
  $self->{inner}->pwd()
    or die "Не удалось получить путь до активной директории: " . $self->{inner}->message;
}

sub dir($self, $directory = $self->{directory}) {
  my @lines = $self->{inner}->dir($directory)
    or die "Не удалось получить листинг активной директории: " . $self->{inner}->message;

  return @lines;
}

sub DESTROY($self) {
  $self->{inner}->quit()
    or die "Не удалось разорвать соединение с сервером: " . $self->{inner}->message;
}

1;
