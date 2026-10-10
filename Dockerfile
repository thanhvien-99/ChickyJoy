# ChickyJoy ASP.NET Core 8 - Render
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY GaGionEcommerce/GaGionEcommerce.csproj GaGionEcommerce/
RUN dotnet restore GaGionEcommerce/GaGionEcommerce.csproj
COPY GaGionEcommerce/ GaGionEcommerce/
RUN dotnet publish GaGionEcommerce/GaGionEcommerce.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish ./
ENV ASPNETCORE_URLS=http://0.0.0.0:10000
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 10000
ENTRYPOINT ["dotnet", "GaGionEcommerce.dll"]
