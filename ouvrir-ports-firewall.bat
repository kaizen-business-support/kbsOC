@echo off
echo Ouverture des ports pour OptimusCredit...
netsh advfirewall firewall add rule name="OptimusCredit Frontend 3006" dir=in action=allow protocol=TCP localport=3006
netsh advfirewall firewall add rule name="OptimusCredit Backend 5007" dir=in action=allow protocol=TCP localport=5007
echo.
echo Ports 3006 et 5007 ouverts avec succes !
pause
