#!/usr/bin/env perl

use strict;
use warnings;
use CGI;
use CGI::Carp;
use JSON::PP;
use Net::FTP;

my $cgi = CGI->new;

# Обработка входных данных
my $input = { map { $_ => scalar $cgi->param($_) } $cgi->param };

if ($cgi->request_method eq 'POST' && $cgi->content_type =~ /application\/json/) {
    my $json_text = $cgi->param('POSTDATA');
    unless (defined $json_text && $json_text ne '') {
        local $/;  # Читаем весь поток
        $json_text = <STDIN>;
    }
    $input = decode_json($json_text);
}

# Извлечение параметров
my ($host, $user, $pass, $port, $command, $filename, $current_dir) = (
    $input->{host},
    $input->{user},
    $input->{pass},
    $input->{port} || 21,
    $input->{command} || 'list',
    $input->{filename},
    $input->{current_dir} || '/'
);

# Валидация
unless ($host && $user && $pass) {
    send_json({ error => "Не заполнены обязательные поля" }, 400);
}

eval {
    my $ftp = Net::FTP->new(
        Host    => $host,
        Port    => $port,
        Passive => 1,
        Timeout => 30
    ) or die "Не удалось подключиться: $@";

    $ftp->login($user, $pass) or die "Ошибка авторизации: " . $ftp->message;

    if ($command eq 'list') {
        $ftp->cwd($current_dir) if $current_dir ne '/';
        $current_dir = $ftp->pwd;

        my @files;
        foreach my $line ($ftp->dir) {
            my @parts = split(/\s+/, $line, 9);
            my $file = {
                name => $parts[8],
                is_dir => ($line =~ /^d/) ? \1 : \0
            };
            push @files, $file;
        }

        send_json({
            current_dir => $current_dir,
            files => \@files
        });
    }
    elsif ($command eq 'download') {
        $ftp->cwd($current_dir);
        print $cgi->header(
            -type        => 'application/octet-stream',
            -attachment  => $filename,
            -charset     => 'binary'
        );
        $ftp->get($filename, \*STDOUT) or die $ftp->message;
        exit;
    }
    elsif ($command eq 'upload') {
        my $upload = $cgi->upload('file');
        $ftp->cwd($current_dir);
        $ftp->put($upload, $filename) or die $ftp->message;
        send_json({ success => 1 });
    }
    else {
        die "Неизвестная команда: $command";
    }

    $ftp->quit;
};

if ($@) {
    send_json({ error => $@ }, 500);
}

sub send_json {
    my ($data, $status) = @_;
    print $cgi->header(
        -type => 'application/json',
        -charset => 'UTF-8',
        -status => $status || 200
    );
    print encode_json($data);
    exit;
}