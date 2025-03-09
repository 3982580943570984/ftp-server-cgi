package Handler;

use strict;
use warnings;
use utf8;
use feature qw(signatures);
no warnings qw(experimental::signatures);

use CGI;
use CGI::Carp qw(fatalsToBrowser);
use Carp;
use JSON::PP;

require Ftp;
require Printer;
require Logger;

sub new($class) {
  my $self = bless { cgi => CGI->new() }, $class;

  $self->parse_parameters();

  $self->{ftp} = Ftp->new(
    $self->{host},
    $self->{port},
    $self->{username},
    $self->{password},
  );

  return $self;
}

sub handle($self, $command = $self->{command}) {
  $self->can($command)
    ? $self->$command()
    : die "Не удалось определить поведение для команды: $command";
}

sub send($self, $data, $status = 200) {
  print $self->{cgi}->header(
    -type => 'application/json',
    -charset => 'UTF-8',
    -status => $status,
  );

  print encode_json($data);
}

sub parse_parameters($self, $cgi = $self->{cgi}) {
  my $parameters = { map { $_ => scalar $cgi->param($_) } $cgi->param };

  if ($cgi->request_method eq 'POST' && $cgi->content_type =~ /application\/json/) {
    $parameters = decode_json(scalar $cgi->param('POSTDATA'));
  }

  $self->send({ error => "Не заполнены обязательные поля" }, 400) unless (
    $parameters->{host} &&
    $parameters->{username} &&
    $parameters->{password}
  );

  (
    $self->{host},
    $self->{port},
    $self->{username},
    $self->{password},
    $self->{command},
    $self->{filename},
    $self->{directory},
    $self->{recurse},
    $self->{name}
  ) = (
    $parameters->{host},
    $parameters->{port},
    $parameters->{username},
    $parameters->{password},
    $parameters->{command} || "list",
    $parameters->{filename},
    $parameters->{directory} || '/',
    $parameters->{recurse} || 1,
    $parameters->{name} || ""
  );

  Logger::log("Параметры для обработчика: '%s'", [$parameters]);
};

sub list(
  $self,
  $ftp = $self->{ftp},
  $directory = $self->{directory}
) {
  Logger::log("Листинг для директории '%s'", [$directory]);

  $self->send({
    directory => $ftp->directory($directory),
    files => $ftp->listing
  });
};

sub download(
  $self,
  $cgi = $self->{cgi},
  $ftp = $self->{ftp},
  $directory = $self->{directory},
  $filename = $self->{filename}
) {
  Logger::log("Скачивание из директории '%s' файла '%s'", [$directory, $filename]);

  print $cgi->header(
  -type => 'application/octet-stream',
  -attachment => $filename,
  -charset => 'binary'
  );

  print $ftp->get($directory, $filename);
};

sub upload(
  $self,
  $cgi = $self->{cgi},
  $ftp = $self->{ftp},
  $directory = $self->{directory},
  $filename = $self->{filename}
) {
  Logger::log("Загрузка в директорию '%s' файла '%s'", [$directory, $filename]);

  $ftp->put($directory, $filename, $cgi->upload('file'));

  $self->send({ success => 1 });
};

sub view(
  $self,
  $ftp = $self->{ftp},
  $directory = $self->{directory},
  $filename = $self->{filename}
) {
  Logger::log("Получение из директории '%s' содержимого файла '%s'", [$directory, $filename]);

  $self->send({ contents => $ftp->get($directory, $filename) });
};

sub rename(
  $self,
  $ftp = $self->{ftp},
  $directory = $self->{directory},
  $filename = $self->{filename},
  $name = $self->{name}
) {
  Logger::log("Переименование из директории '%s' файла '%s'", [$directory, $filename]);

  $ftp->rename($directory, $filename, $name);

  $self->send({success => 1});
}

sub delete(
  $self,
  $ftp = $self->{ftp},
  $directory = $self->{directory},
  $filename = $self->{filename}
) {
  Logger::log("Удаление из директории '%s' файла '%s'", [$directory, $filename]);

  $ftp->delete($directory, $filename);

  $self->send({ success => 1 });
}

sub make_directory(
  $self,
  $directory = $self->{directory},
  $recurse = $self->{recurse}
) {
  Logger::log("Создана директория '%s'", [$directory]);

  $self->{ftp}->make_directory($directory, $recurse)
    or die "Не удалось создать директорию '$directory': " . $self->{inner}->message;
}

sub remove_directory(
  $self,
  $directory = $self->{directory},
  $recurse = $self->{recurse}
) {
  Logger::log("Удалена директория '%s'", [$directory]);

  $self->{ftp}->remove_directory($directory, $recurse)
    or die "Не удалось удалить директорию '$directory': " . $self->{inner}->message;
}

1;
