using Cavex.Principal.ApiClients.EmpEmpleado;
using Cavex.Principal.Common;
using Cavex.Principal.Models.EmpEmpleado;
using Cavex.Principal.Services.Interfaces;
using Refit;
using System.Net;
using System.Text;

namespace Cavex.Principal.Services.Implementations
{
    
        public class EmpEmpleadoService : IEmpEmpleadoService
        {
            private readonly IEmpEmpleadoApi _empEmpleadoApi;
            private readonly ILogger<EmpEmpleadoService> _logger;

            public EmpEmpleadoService(
                IEmpEmpleadoApi empEmpleadoApi,
                ILogger<EmpEmpleadoService> logger)
            {
                _empEmpleadoApi = empEmpleadoApi;
                _logger = logger;
            }

            public async Task<ResponseWrapper<PagedResponse<EmpEmpleadoDto>>> ObtenerTodosAsync(
                int pageIndex = 1,
                int pageSize = 10,
                string? search = null,
                int? status = null,
                CancellationToken cancellationToken = default)
            {
                return await ExecuteAsync(
                    () => _empEmpleadoApi.GetAllAsync(pageIndex, pageSize, search, status, cancellationToken),
                    "No fue posible obtener los empleados.");
            }

            public async Task<ResponseWrapper<EmpEmpleadoDto>> ObtenerPorIdAsync(int id, CancellationToken cancellationToken = default)
            {
                return await ExecuteAsync(
                    () => _empEmpleadoApi.GetByIdAsync(id, cancellationToken),
                    "No fue posible obtener el empleado solicitado.");
            }

            /// <summary>
            /// Solicita el PDF a través del cliente Refit existente y convierte la respuesta HTTP
            /// en un resultado binario seguro para el controlador MVC.
            /// </summary>
            /// <param name="id">Identificador del empleado cuyo expediente se solicita.</param>
            /// <param name="cancellationToken">
            /// Señal que permite cancelar la descarga si la petición del navegador termina.
            /// </param>
            /// <returns>
            /// Un contenedor con los bytes y metadatos del PDF, o un estado de error con un mensaje
            /// seguro cuando la API rechaza la solicitud o no está disponible.
            /// </returns>
            public async Task<ResponseWrapper<EmpleadoPdfFileResult>> ObtenerPdfAsync(
                int id,
                CancellationToken cancellationToken = default)
            {
                // La validación local evita una llamada HTTP que la API necesariamente rechazaría.
                // También mantiene una respuesta coherente cuando el método se invoca desde otra
                // parte del MVC distinta al botón de detalle.
                if (id <= 0)
                {
                    return ResponseWrapper<EmpleadoPdfFileResult>.Fail(
                        "El identificador del empleado debe ser mayor que cero.",
                        HttpStatusCode.BadRequest);
                }

                try
                {
                    // HttpResponseMessage se utiliza deliberadamente porque el cuerpo es un PDF.
                    // Si se devolviera un DTO, Refit intentaría tratar estos bytes como JSON.
                    using var response = await _empEmpleadoApi.GetPdfAsync(id, cancellationToken);

                    if (!response.IsSuccessStatusCode)
                    {
                        _logger.LogWarning(
                            "La API rechazó el PDF del empleado {EmpleadoId}. StatusCode: {StatusCode}.",
                            id,
                            response.StatusCode);

                        return ResponseWrapper<EmpleadoPdfFileResult>.Fail(
                            CrearMensajePdf(response.StatusCode),
                            response.StatusCode);
                    }

                    // Solo se acepta el tipo declarado por el contrato del endpoint. Esta revisión
                    // impide reenviar accidentalmente una página HTML o un error JSON como si fuera PDF.
                    var contentType = response.Content.Headers.ContentType?.MediaType;
                    if (!string.Equals(contentType, "application/pdf", StringComparison.OrdinalIgnoreCase))
                    {
                        _logger.LogError(
                            "La API devolvió un tipo inesperado para el PDF del empleado {EmpleadoId}: {ContentType}.",
                            id,
                            contentType ?? "sin Content-Type");

                        return ResponseWrapper<EmpleadoPdfFileResult>.Fail(
                            "No fue posible generar el expediente PDF del empleado.",
                            HttpStatusCode.BadGateway);
                    }

                    // La lectura binaria conserva exactamente el contenido generado por la API.
                    // El archivo permanece en memoria y nunca se escribe en el sistema de archivos.
                    var content = await response.Content.ReadAsByteArrayAsync(cancellationToken);
                    if (!TieneFirmaPdf(content))
                    {
                        _logger.LogError(
                            "La API devolvió un PDF vacío o inválido para el empleado {EmpleadoId}.",
                            id);

                        return ResponseWrapper<EmpleadoPdfFileResult>.Fail(
                            "No fue posible generar el expediente PDF del empleado.",
                            HttpStatusCode.BadGateway);
                    }

                    // Aunque la API ya sanea el nombre, el MVC vuelve a limitarlo antes de usarlo
                    // en Content-Disposition para no confiar ciegamente en una cabecera externa.
                    var nombreRecibido = response.Content.Headers.ContentDisposition?.FileNameStar
                        ?? response.Content.Headers.ContentDisposition?.FileName;
                    var nombreSeguro = CrearNombrePdfSeguro(nombreRecibido, id);

                    return ResponseWrapper<EmpleadoPdfFileResult>.Ok(
                        new EmpleadoPdfFileResult
                        {
                            Content = content,
                            ContentType = "application/pdf",
                            FileName = nombreSeguro
                        });
                }
                catch (ApiException exception)
                {
                    // Refit puede representar respuestas no exitosas como ApiException dependiendo
                    // del tipo de retorno. Se conserva el estado, pero nunca el contenido técnico.
                    _logger.LogError(
                        exception,
                        "Error de la API al solicitar el PDF del empleado {EmpleadoId}. StatusCode: {StatusCode}.",
                        id,
                        exception.StatusCode);

                    return ResponseWrapper<EmpleadoPdfFileResult>.Fail(
                        CrearMensajePdf(exception.StatusCode),
                        exception.StatusCode);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    // Una cancelación iniciada por el navegador forma parte del ciclo normal de la
                    // petición; se propaga para que ASP.NET Core detenga el procesamiento pendiente.
                    throw;
                }
                catch (OperationCanceledException exception)
                {
                    _logger.LogError(
                        exception,
                        "La solicitud del PDF del empleado {EmpleadoId} excedió el tiempo permitido.",
                        id);

                    return ResponseWrapper<EmpleadoPdfFileResult>.Fail(
                        "No fue posible generar el expediente PDF del empleado.",
                        HttpStatusCode.GatewayTimeout);
                }
                catch (HttpRequestException exception)
                {
                    // Este caso cubre principalmente una API apagada, una conexión rechazada o un
                    // fallo de red. El log conserva el diagnóstico y el usuario recibe un texto seguro.
                    _logger.LogError(
                        exception,
                        "No fue posible conectar con la API para obtener el PDF del empleado {EmpleadoId}.",
                        id);

                    return ResponseWrapper<EmpleadoPdfFileResult>.Fail(
                        "No fue posible generar el expediente PDF del empleado.",
                        HttpStatusCode.ServiceUnavailable);
                }
                catch (Exception exception)
                {
                    _logger.LogError(
                        exception,
                        "Error inesperado al obtener el PDF del empleado {EmpleadoId}.",
                        id);

                    return ResponseWrapper<EmpleadoPdfFileResult>.Fail(
                        "No fue posible generar el expediente PDF del empleado.",
                        HttpStatusCode.InternalServerError);
                }
            }

            public async Task<ResponseWrapper<EmpEmpleadoDto>> CrearAsync(
                EmpEmpleadoSaveDto request,
                CancellationToken cancellationToken = default)
            {
                return await ExecuteAsync(
                    () => _empEmpleadoApi.CreateAsync(RequestWrapper<EmpEmpleadoSaveDto>.Create(request), cancellationToken),
                    "No fue posible crear el empleado.");
            }

            public async Task<ResponseWrapper<EmpEmpleadoDto>> ActualizarAsync(
                int id,
                EmpEmpleadoSaveDto request,
                CancellationToken cancellationToken = default)
            {
                return await ExecuteAsync(
                    () => _empEmpleadoApi.UpdateAsync(id, RequestWrapper<EmpEmpleadoSaveDto>.Create(request), cancellationToken),
                    "No fue posible actualizar el empleado.");
            }

            public async Task<ResponseWrapper<bool>> EliminarAsync(int id, CancellationToken cancellationToken = default)
            {
                return await ExecuteAsync(
                    () => _empEmpleadoApi.DeleteAsync(id, cancellationToken),
                    "No fue posible eliminar el empleado.");
            }

            /// <summary>
            /// Traduce el estado devuelto por la API a un mensaje apto para mostrarse al usuario.
            /// </summary>
            /// <param name="statusCode">Código HTTP recibido al solicitar el expediente.</param>
            /// <returns>Mensaje funcional que no revela contenido interno de la API.</returns>
            private static string CrearMensajePdf(HttpStatusCode statusCode)
            {
                return statusCode switch
                {
                    HttpStatusCode.BadRequest => "El identificador del empleado no es válido.",
                    HttpStatusCode.NotFound => "No se encontró el empleado solicitado.",
                    _ => "No fue posible generar el expediente PDF del empleado."
                };
            }

            /// <summary>
            /// Comprueba la firma estándar del formato PDF antes de reenviar los bytes al navegador.
            /// </summary>
            /// <param name="content">Contenido binario leído desde la respuesta de la API.</param>
            /// <returns>
            /// <see langword="true"/> cuando el contenido inicia con la firma <c>%PDF-</c>.
            /// </returns>
            private static bool TieneFirmaPdf(ReadOnlySpan<byte> content)
            {
                return content.StartsWith("%PDF-"u8);
            }

            /// <summary>
            /// Convierte el nombre recibido en una forma segura para la cabecera Content-Disposition.
            /// </summary>
            /// <param name="fileName">Nombre informado por la API, posiblemente entre comillas.</param>
            /// <param name="id">Identificador usado para construir un nombre alternativo confiable.</param>
            /// <returns>Nombre ASCII sin directorios y con extensión PDF.</returns>
            private static string CrearNombrePdfSeguro(string? fileName, int id)
            {
                var fallback = $"Empleado_{id}.pdf";
                if (string.IsNullOrWhiteSpace(fileName))
                {
                    return fallback;
                }

                var candidate = fileName.Trim().Trim('"');
                const string utf8Prefix = "UTF-8''";
                if (candidate.StartsWith(utf8Prefix, StringComparison.OrdinalIgnoreCase))
                {
                    candidate = candidate[utf8Prefix.Length..];
                }

                try
                {
                    candidate = Uri.UnescapeDataString(candidate);
                }
                catch (UriFormatException)
                {
                    return fallback;
                }

                // Path.GetFileName elimina cualquier directorio que una cabecera externa intentara
                // incorporar. Después se admite solamente un conjunto ASCII apropiado para HTTP.
                candidate = Path.GetFileName(candidate.Replace('\\', '/'));
                var safeName = new StringBuilder(candidate.Length);

                foreach (var character in candidate)
                {
                    var isAsciiLetterOrDigit =
                        character is >= 'a' and <= 'z'
                        or >= 'A' and <= 'Z'
                        or >= '0' and <= '9';

                    if (isAsciiLetterOrDigit || character is '_' or '-' or '.')
                    {
                        safeName.Append(character);
                    }
                    else if (safeName.Length == 0 || safeName[^1] != '_')
                    {
                        safeName.Append('_');
                    }
                }

                var result = safeName.ToString().Trim('_', '.');
                return !string.IsNullOrWhiteSpace(result)
                    && result.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)
                        ? result
                        : fallback;
            }

            private async Task<ResponseWrapper<T>> ExecuteAsync<T>(
                Func<Task<ResponseWrapper<T>>> apiCall,
                string fallbackMessage)
            {
                try
                {
                    var response = await apiCall();

                    return response.Success
                        ? response
                        : new ResponseWrapper<T>
                        {
                            StatusCode = response.StatusCode,
                            Message = string.IsNullOrWhiteSpace(response.Message) ? fallbackMessage : response.Message,
                            Data = response.Data
                        };
                }
                catch (ApiException exception)
                {
                    _logger.LogError(exception, "API error while consuming EmpEmpleado. StatusCode: {StatusCode}", exception.StatusCode);

                    return new ResponseWrapper<T>
                    {
                        StatusCode = exception.StatusCode,
                        Message = !string.IsNullOrWhiteSpace(exception.Content) ? exception.Content : fallbackMessage
                    };
                }
                catch (OperationCanceledException exception)
                {
                    _logger.LogError(exception, "Timeout while consuming EmpEmpleado.");

                    return new ResponseWrapper<T>
                    {
                        StatusCode = HttpStatusCode.GatewayTimeout,
                        Message = fallbackMessage
                    };
                }
                catch (Exception exception)
                {
                    _logger.LogError(exception, "Unexpected error while consuming EmpEmpleado.");

                    return new ResponseWrapper<T>
                    {
                        StatusCode = HttpStatusCode.InternalServerError,
                        Message = fallbackMessage
                    };
                }
            }
        }
    }

