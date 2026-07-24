using Cavex.Principal.Common;
using Cavex.Principal.Models.EmpEmpleado;

namespace Cavex.Principal.Services.Interfaces
{
    public interface IEmpEmpleadoService
    {
        Task<ResponseWrapper<PagedResponse<EmpEmpleadoDto>>> ObtenerTodosAsync(
            int pageIndex = 1,
            int pageSize = 10,
            string? search = null,
            int? status = null,
            CancellationToken cancellationToken = default);

        Task<ResponseWrapper<EmpEmpleadoDto>> ObtenerPorIdAsync(int id, CancellationToken cancellationToken = default);

        /// <summary>
        /// Obtiene desde la API el expediente PDF del empleado sin intentar interpretarlo como JSON.
        /// </summary>
        /// <param name="id">Identificador del empleado solicitado.</param>
        /// <param name="cancellationToken">Señal utilizada para cancelar la petición HTTP.</param>
        /// <returns>
        /// Resultado que incluye el estado seguro de la operación y, cuando fue correcta, los bytes,
        /// el tipo de contenido y el nombre saneado del archivo.
        /// </returns>
        Task<ResponseWrapper<EmpleadoPdfFileResult>> ObtenerPdfAsync(
            int id,
            CancellationToken cancellationToken = default);

        Task<ResponseWrapper<EmpEmpleadoDto>> CrearAsync(EmpEmpleadoSaveDto request, CancellationToken cancellationToken = default);

        Task<ResponseWrapper<EmpEmpleadoDto>> ActualizarAsync(int id, EmpEmpleadoSaveDto request, CancellationToken cancellationToken = default);

        Task<ResponseWrapper<bool>> EliminarAsync(int id, CancellationToken cancellationToken = default);
    }
}
