#!/usr/bin/env perl

use strict;
use warnings;
use CGI qw(:standard);
use Net::FTP;
use CGI::Carp qw(fatalsToBrowser);

my $cgi = new CGI;

# Только обработка POST-запросов
unless ($cgi->request_method() eq 'POST') {
    print $cgi->redirect('../index.html');
    exit;
}

# Получение параметров
my ($host, $user, $pass, $port, $command, $filename) = (
    $cgi->param('host'),
    $cgi->param('user'),
    $cgi->param('pass'),
    $cgi->param('port') || 2121,
    $cgi->param('command'),
    $cgi->param('filename')
);

# Валидация параметров
unless ($host && $user && $pass && $command) {
    show_error("Не заполнены обязательные поля");
}

# Обработка команд
eval {
    my $ftp = Net::FTP->new(
        Host    => $host,
        Port    => $port,
        Passive => 1,
        Timeout => 30
    ) or die "Не удалось подключиться: $@";

    $ftp->login($user, $pass) or die "Ошибка авторизации: " . $ftp->message;

    if ($command eq 'list') {
        show_file_list($ftp->ls());
    }
    elsif ($command eq 'download') {
        download_file($ftp, $filename);
    }
    elsif ($command eq 'upload') {
        upload_file($ftp, $cgi->upload('file'), $filename);
    }
    else {
        die "Неизвестная команда: $command";
    }

    $ftp->quit;
};

if ($@) {
    show_error($@);
}

# ========== Субрутины ==========

sub download_file {
    my ($ftp, $filename) = @_;

    unless ($filename) {
        show_error("Укажите имя файла для скачивания");
    }

    print $cgi->header(
        -type        => 'application/octet-stream',
        -attachment  => $filename,
        -charset     => 'binary'
    );

    binmode(STDOUT);
    $ftp->get($filename, \*STDOUT) or die $ftp->message;
    exit;
}

sub upload_file {
    my ($ftp, $upload, $filename) = @_;

    unless ($filename && $upload) {
        show_error("Укажите файл и имя для загрузки");
    }

    $ftp->put($upload, $filename) or die $ftp->message;
    show_success("Файл успешно загружен");
}

sub show_file_list {
    my @files = @_;
    print $cgi->header('text/html');
    print "<h3>Содержимое каталога:</h3><ul>";
    print "<li>$_</li>" for @files;
    print "</ul>";
}

sub show_success {
    my ($message) = @_;
    print $cgi->header('text/html');
    print "<div class='success'>$message</div>";
    print_link_back();
}

sub show_error {
    my ($error) = @_;
    print $cgi->header('text/html');
    print "<div class='error'>Ошибка: $error</div>";
    print_link_back();
    exit;
}

sub print_link_back {
    print "<p><a href='/index.html'>Вернуться к форме</a></p>";
}